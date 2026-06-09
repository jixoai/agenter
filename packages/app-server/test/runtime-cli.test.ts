import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import { createRuntimeShellCommands } from "../src/runtime-cli";
import { createRootWorkspaceShellWorld } from "../src/workspace-system/root-exec";

const openServers: Server[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => {
            if (error) {
              rejectClose(error);
              return;
            }
            resolveClose();
          });
        }),
    ),
  );
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const startMockRuntimeApi = async (responses?: Record<string, Record<string, unknown>>) => {
  const requests: Array<{
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of request) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    requests.push({
      url: request.url ?? "",
      headers: request.headers,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    const payload = responses?.[request.url ?? ""] ?? { result: { ok: true } };
    response.end(`${JSON.stringify({ ok: true, ...payload })}\n`);
  });
  openServers.push(server);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("expected mock runtime api address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getLastRequest: () => requests.at(-1) ?? null,
    getRequests: () => requests,
  };
};

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-runtime-cli-"));
  tempDirs.push(root);
  return root;
};

const createRuntimeCommand = (
  baseUrl: string,
  name: string,
  options?: {
    rootWorkspacePath?: string;
    homeDir?: string;
    principalId?: string;
  },
) => {
  const command = createRuntimeShellCommands({
    baseUrl,
    privateKey: "test-private-key",
    rootWorkspacePath: options?.rootWorkspacePath ?? "/tmp/agenter-root",
    homeDir: options?.homeDir,
    principalId: options?.principalId,
  }).find((item) => item.name === name);
  if (!command) {
    throw new Error(`expected ${name} command`);
  }
  return command;
};

const createCommandContext = (stdin = "", signal?: AbortSignal) => ({
  fs: new InMemoryFs(),
  cwd: "/",
  env: new Map(),
  stdin,
  signal,
});

describe("Feature: runtime descriptor CLI", () => {
  test("Scenario: Given JSON argv When message send runs Then the CLI posts the validated descriptor payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/send": {
        result: {
          ok: true,
          messageId: 2,
          recentMessages: [
            {
              messageId: 1,
              from: "User",
              contentPreview: "上一条消息",
              sendTime: "20260412142500040",
            },
            {
              messageId: 2,
              from: "architect",
              contentPreview: "APP-ACK: 开始构建",
              sendTime: "20260412142500042",
            },
          ],
        },
      },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["send", '{"chatId":"room-1","ref":1,"content":"APP-ACK: 开始构建","followUpAfterMs":30000}'],
      createCommandContext(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"recentMessages"');
    expect(result.stdout).toContain('"sendTime": "20260412142500042"');
    expect(result.stdout).toContain("APP-ACK: 开始构建");
    expect(api.getLastRequest()).toEqual({
      url: "/v1/message/send",
      headers: expect.objectContaining({
        "x-agenter-principal-key": "test-private-key",
      }),
      body: {
        chatId: "room-1",
        ref: 1,
        content: "APP-ACK: 开始构建",
        followUpAfterMs: 30000,
      },
    });
  });

  test("Scenario: Given a non-positive follow-up reminder When message send runs Then descriptor validation rejects the payload before the runtime API call", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["send", '{"chatId":"room-1","content":"APP-ACK: 开始构建","followUpAfterMs":0}'],
      createCommandContext(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("followUpAfterMs");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given JSON stdin When message edit runs Then the CLI posts the validated edit payload to the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/edit": { result: { ok: true, messageId: 1, updatedAt: 42 } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["edit"],
      createCommandContext(
        JSON.stringify({
          chatId: "room-1",
          messageId: 1,
          content: "Correction: use /preview/42 instead.",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      messageId: 1,
      content: "Correction: use /preview/42 instead.",
    });
  });

  test("Scenario: Given JSON stdin When message recall runs Then the CLI posts the validated recall payload to the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/recall": { result: { ok: true, messageId: 1, updatedAt: 42, recalledAt: 42 } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["recall"],
      createCommandContext(
        JSON.stringify({
          chatId: "room-1",
          messageId: 1,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      messageId: 1,
    });
  });

  test("Scenario: Given explicit compact argv When terminal stop runs Then the CLI decodes the positional payload back into the descriptor object", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/stop": { result: { ok: true, message: "stopped" } },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["stop", "--compact", '["term-1"]'], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
    });
  });

  test("Scenario: Given JSON stdin When terminal bootstrap runs Then the CLI posts the explicit lifecycle payload to the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/bootstrap": {
        result: {
          ok: true,
          message: "terminal bootstrapped",
          terminal: {
            terminalId: "term-1",
            processKind: "shell",
            command: ["bash"],
            launchCwd: "/repo",
            workspace: null,
            status: "IDLE",
            processPhase: "running",
            focused: true,
            configuredTitle: "Chess Dev",
            currentTitle: "npm run dev",
            currentPath: "/repo/apps/web",
            transportUrl: "ws://127.0.0.1:4000/term-1",
          },
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(
      ["bootstrap"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"processPhase": "running"');
    expect(result.stdout).toContain('"currentPath": "/repo/apps/web"');
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
    });
  });

  test("Scenario: Given JSON stdin When terminal read runs without consumption Then the CLI preserves cursor and activity flags", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/read": {
        result: {
          representation: "diff",
          readCursor: {
            terminalId: "term-1",
            readerActorId: "session-actor",
            consumed: false,
          },
          recordedActivity: false,
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(
      ["read"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
          mode: "auto",
          remark: false,
          recordActivity: false,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
      mode: "auto",
      remark: false,
      recordActivity: false,
    });
  });

  test("Scenario: Given JSON stdin When terminal await runs Then the CLI posts the bounded observation payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/await": {
        result: {
          kind: "terminal-await",
          terminalId: "term-1",
          outcome: "matched",
          snapshot: {
            lines: ["ready"],
          },
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(
      ["await"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
          wait: {
            until: "match",
            timeoutMs: 60_000,
            idleMs: 1_000,
          },
          match: {
            pattern: "ready|error",
            regex: true,
            caseInsensitive: true,
            contextLines: 2,
          },
          view: {
            type: "tail",
            lines: 80,
          },
          recordActivity: false,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"outcome": "matched"');
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
      wait: {
        until: "match",
        timeoutMs: 60_000,
        idleMs: 1_000,
      },
      match: {
        pattern: "ready|error",
        regex: true,
        caseInsensitive: true,
        contextLines: 2,
      },
      view: {
        type: "tail",
        lines: 80,
      },
      recordActivity: false,
    });
  });

  test("Scenario: Given legacy compact terminal read input When the CLI decodes it Then recordActivity keeps its positional slot", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/read": {
        result: {
          representation: "diff",
          recordedActivity: false,
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["read", "--compact", '["term-1",0,false]'], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
      mode: "auto",
      recordActivity: false,
    });
  });

  test("Scenario: Given root workspace bash expands a UTF-8 JSON payload When message send forwards the heredoc argv Then the runtime API preserves the original Unicode content", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/send": { result: { ok: true, messageId: 1, recentMessages: [] } },
    });
    const rootWorkspacePath = createTempRoot();

    const rootWorld = createRootWorkspaceShellWorld({
      rootWorkspacePath,
      customCommands: createRuntimeShellCommands({
        baseUrl: api.baseUrl,
        privateKey: "test-private-key",
        rootWorkspacePath,
        homeDir: rootWorkspacePath,
      }),
    });
    const result = await rootWorld.exec({
      command: [
        "cat << 'PAYLOAD' > msg_payload.json",
        '{"chatId":"room-1","content":"你好！有什么可以帮你的吗？😊"}',
        "PAYLOAD",
        'message send "$(cat msg_payload.json)"',
      ].join("\n"),
      mounts: [],
    });

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      content: "你好！有什么可以帮你的吗？😊",
    });
  });

  test("Scenario: Given JSON stdin When attention commit runs Then the CLI preserves the descriptor payload shape", async () => {
    const api = await startMockRuntimeApi({
      "/v1/attention/commit": { commit: { commitId: "commit-1" } },
    });
    const attention = createRuntimeCommand(api.baseUrl, "attention");

    const result = await attention.execute(
      ["commit"],
      createCommandContext(
        JSON.stringify({
          contextId: "ctx-chat-main",
          summary: "done",
          done: true,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      contextId: "ctx-chat-main",
      summary: "done",
      done: true,
    });
  });

  test("Scenario: Given JSON stdin When attention context runs Then the CLI posts the explicit context-detail request shape", async () => {
    const api = await startMockRuntimeApi({
      "/v1/attention/context": {
        context: {
          contextId: "ctx-chat-main",
          context: {
            owner: "architect",
            focusState: "focused",
            headCommitId: "commit-1",
            scoreMap: { delivery: 100 },
            content: "Need to inspect full context.",
            createdAt: "2026-04-30T00:00:00.000Z",
            updatedAt: "2026-04-30T00:01:00.000Z",
          },
          commits: [],
          commitCount: 0,
          commitsTruncated: false,
        },
      },
    });
    const attention = createRuntimeCommand(api.baseUrl, "attention");

    const result = await attention.execute(
      ["context"],
      createCommandContext(
        JSON.stringify({
          contextId: "ctx-chat-main",
          commitLimit: 10,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"contextId": "ctx-chat-main"');
    expect(api.getLastRequest()?.body).toEqual({
      contextId: "ctx-chat-main",
      commitLimit: 10,
    });
  });

  test("Scenario: Given explicit compact stdin When message read runs Then the CLI decodes the positional array before calling the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/read": { snapshot: { chatId: "room-1", messages: [] } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["read", "--compact"], createCommandContext('["room-1",5]'));

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      limit: 5,
    });
  });

  test("Scenario: Given terminal-manage and message-manage invite payloads When the CLI runs Then resource-native authority grammar is preserved through the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal-manage/invite": { invitation: { descriptor: { token: "seatinv_terminal" } } },
      "/v1/message-manage/invite": { invitation: { descriptor: { token: "seatinv_message" } } },
    });
    const terminalManage = createRuntimeCommand(api.baseUrl, "terminal-manage");
    const messageManage = createRuntimeCommand(api.baseUrl, "message-manage");

    const terminalResult = await terminalManage.execute(
      ['invite', '{"terminalId":"term-1","participantId":"0x1234567890abcdef1234567890abcdef12345678","seatClass":"RW"}'],
      createCommandContext(),
    );
    expect(terminalResult.exitCode).toBe(0);
    expect(api.getRequests()[0]?.body).toEqual({
      terminalId: "term-1",
      participantId: "0x1234567890abcdef1234567890abcdef12345678",
      seatClass: "RW",
    });

    const messageResult = await messageManage.execute(
      ['invite', '{"chatId":"room-1","participantId":"0x1234567890abcdef1234567890abcdef12345678","seatClass":"admin"}'],
      createCommandContext(),
    );
    expect(messageResult.exitCode).toBe(0);
    expect(api.getRequests()[1]?.body).toEqual({
      chatId: "room-1",
      participantId: "0x1234567890abcdef1234567890abcdef12345678",
      seatClass: "admin",
    });
  });

  test("Scenario: Given terminal-manage accept receives a deep link When the CLI runs Then descriptor transport is preserved for shared acceptance handling", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal-manage/accept": {
        invitation: { descriptor: { token: "seatinv_terminal" } },
        access: { role: "writer", accessToken: "term-token" },
      },
    });
    const terminalManage = createRuntimeCommand(api.baseUrl, "terminal-manage");
    const deepLink = "terminal://join?token=seatinv_1234567890abcdefghijklmn";

    const result = await terminalManage.execute(
      ["accept", JSON.stringify({ descriptor: deepLink })],
      createCommandContext(),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      descriptor: deepLink,
    });
  });

  test("Scenario: Given compact stdin with a wildcard room scope When message query runs Then the CLI preserves the query contract without collapsing auth scope semantics", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/query": {
        result: {
          resultKind: "messages",
          mode: "query",
          chatIds: ["room-1"],
          offset: 0,
          limit: 5,
          nextOffset: null,
          hasMore: false,
          items: [],
        },
      },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["query", "--compact"], createCommandContext('["*",1,"budget incident",0,5]'));

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "*",
      mode: "query",
      query: "budget incident",
      offset: 0,
      limit: 5,
    });
  });

  test("Scenario: Given empty input list command When workspace list runs Then the CLI sends an empty descriptor payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/workspace/list": { workspaces: [] },
    });
    const workspace = createRuntimeCommand(api.baseUrl, "workspace");

    const result = await workspace.execute(["list"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({});
  });

  test("Scenario: Given lifecycle-aware terminal list When the CLI runs Then observed identity and stop facts are preserved in the returned projection", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/list": {
        terminals: [
          {
            terminalId: "term-1",
            processKind: "shell",
            command: ["bash"],
            launchCwd: "/repo",
            workspace: null,
            status: "IDLE",
            processPhase: "killed",
            lifecycleTransition: null,
            focused: false,
            configuredTitle: "Chess Dev",
            currentTitle: "vite preview",
            currentPath: "/repo/apps/web",
            lastStopReason: "killed",
            lastExitCode: 130,
            lastStoppedAt: "2026-04-26T10:00:00.000Z",
          },
        ],
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["list"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"processPhase": "killed"');
    expect(result.stdout).toContain('"currentTitle": "vite preview"');
    expect(result.stdout).toContain('"currentPath": "/repo/apps/web"');
    expect(result.stdout).toContain('"lastStopReason": "killed"');
    expect(api.getLastRequest()?.body).toEqual({});
  });

  test("Scenario: Given JSON stdin When terminal get-config runs Then the CLI requests durable launch truth without guessing from runtime observations", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/get-config": {
        result: {
          terminalId: "term-1",
          processKind: "shell",
          command: ["/bin/bash", "-lc", "npm run dev"],
          launchCwd: "/repo/apps/web",
          profile: {
            title: "Web dev",
            cols: 120,
            rows: 36,
          },
          metadata: {
            owner: "frontend",
          },
          processPhase: "running",
          lifecycleTransition: "bootstrapping",
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(
      ["get-config"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"launchCwd": "/repo/apps/web"');
    expect(result.stdout).toContain('"lifecycleTransition": "bootstrapping"');
    expect(result.stdout).not.toContain('"currentPath"');
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
    });
  });

  test("Scenario: Given JSON stdin When terminal set-config runs Then the CLI posts a patch payload and renders live-vs-next-bootstrap results", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/set-config": {
        result: {
          config: {
            terminalId: "term-1",
            processKind: "shell",
            command: ["/bin/bash", "-lc", "npm run dev"],
            launchCwd: "/repo/apps/web",
            profile: {
              title: "Web dev",
              cols: 132,
              rows: 40,
            },
            metadata: {
              owner: "frontend",
            },
            processPhase: "running",
            lifecycleTransition: null,
          },
          appliedLiveFields: ["cols", "rows"],
          nextBootstrapFields: ["command", "launchCwd"],
        },
      },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(
      ["set-config"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
          command: ["/bin/bash", "-lc", "npm run dev"],
          launchCwd: "/repo/apps/web",
          cols: 132,
          rows: 40,
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"appliedLiveFields"');
    expect(result.stdout).toContain('"nextBootstrapFields"');
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
      command: ["/bin/bash", "-lc", "npm run dev"],
      launchCwd: "/repo/apps/web",
      cols: 132,
      rows: 40,
    });
  });

  test("Scenario: Given descriptor help probe When terminal write --help runs Then schema-backed help is returned locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["write", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Write literal raw input bytes into a terminal.");
    expect(result.stdout).toContain('"terminalId"');
    expect(result.stdout).toContain('"text"');
    expect(result.stdout).toContain("Preferred default through `root_bash`");
    expect(result.stdout).toContain("command: `terminal write`");
    expect(result.stdout).toContain("stdin:");
    expect(result.stdout).toContain("Single argv JSON fallback for trivial payloads");
    expect(result.stdout).toContain("Compact positional mode:");
    expect(result.stdout).toContain("Availability: Available");
    expect(result.stdout).toContain('[0] terminalId: string');
    expect(result.stdout).toContain('[1] text: string');
    expect(result.stdout).toContain('[2] returnRead?: value');
    expect(result.stdout).toContain('[3] readRecordActivity?: boolean');
    expect(result.stdout).toContain('[4] readMode?: 0="auto", 1="diff", 2="snapshot"');
    expect(result.stdout).toContain("Operator notes:");
    expect(result.stdout).toContain("only confirms input delivery");
    expect(result.stdout).toContain("`terminal write` is raw mode");
    expect(result.stdout).toContain("terminal input");
    expect(result.stdout).toContain("For a Guard actor");
    expect(result.stdout).toContain("createApprovalRequest:true");
    expect(result.stdout).toContain("approvalRequest");
    expect(result.stdout).toContain("did not reach the PTY yet");
    expect(result.stdout).toContain("terminal-local approval");
    expect(result.stdout).toContain("root_bash");
    expect(result.stdout).toContain("workspace_bash");
    expect(result.stdout).toContain("Denied or expired approval");
    expect(result.stdout).toContain("duplicate work");
    expect(result.stdout).toContain("skill info agenter-terminal");
    expect(result.stdout).toContain("references/input-modes.md");
    expect(result.stdout).not.toContain("cat <<'EOF'");
    expect(result.stdout).toContain("Default to JSON stdin");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given MCP descriptor help probes When mcp query --help runs Then SQL table schemas and JSON row output are documented locally", async () => {
    const api = await startMockRuntimeApi();
    const mcp = createRuntimeCommand(api.baseUrl, "mcp");

    const result = await mcp.execute(["query", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Run read-only SQL over mcp_installed and mcp_enabled");
    expect(result.stdout).toContain("Execution always returns `{ rows:");
    expect(result.stdout).toContain("mcp_installed(name,title,description,transport_kind");
    expect(result.stdout).toContain("mcp_enabled(name,project_path,enabled,enabled_source");
    expect(result.stdout).toContain("enabled=0, enabled_source='default'");
    expect(result.stdout).toContain("Without `projectPath`");
    expect(result.stdout).toContain("tools_json like $pattern");
    expect(result.stdout).toContain("command: `mcp query`");
    expect(result.stdout).toContain("Preferred default through `root_bash`");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given MCP descriptor help probes When mcp probe --help runs Then isolated probe semantics are documented locally", async () => {
    const api = await startMockRuntimeApi();
    const mcp = createRuntimeCommand(api.baseUrl, "mcp");

    const result = await mcp.execute(["probe", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Open or use an isolated MCP probe session");
    expect(result.stdout).toContain("never installs, enables, starts a durable project instance");
    expect(result.stdout).toContain('`action:"open"`');
    expect(result.stdout).toContain("ping");
    expect(result.stdout).toContain("read-resource");
    expect(result.stdout).toContain("get-prompt");
    expect(result.stdout).toContain("call-tool");
    expect(result.stdout).toContain("stdin, stdout, stderr, exitCode");
    expect(result.stdout).toContain("command: `mcp probe`");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given MCP CLI commands When add and call execute Then they post descriptor-backed JSON to runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/mcp/add": {
        result: {
          name: "thinking",
        },
      },
      "/v1/mcp/call": {
        result: {
          instance: {
            name: "thinking",
            projectPath: "/repo/app",
            lifecycle: "running",
          },
          result: {
            content: [{ type: "text", text: "ok" }],
          },
        },
      },
    });
    const mcp = createRuntimeCommand(api.baseUrl, "mcp");

    const add = await mcp.execute(
      ["add"],
      createCommandContext(
        JSON.stringify({
          name: "thinking",
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
          },
        }),
      ),
    );
    const call = await mcp.execute(
      ["call"],
      createCommandContext(
        JSON.stringify({
          name: "thinking",
          projectPath: "/repo/app",
          toolName: "sequentialthinking",
          arguments: {
            thought: "test",
            nextThoughtNeeded: false,
            thoughtNumber: 1,
            totalThoughts: 1,
          },
        }),
      ),
    );

    expect(add.exitCode).toBe(0);
    expect(call.exitCode).toBe(0);
    expect(api.getRequests().map((request) => request.url)).toEqual(["/v1/mcp/add", "/v1/mcp/call"]);
    expect(api.getRequests()[0]?.body).toEqual({
      name: "thinking",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      },
    });
    expect(api.getRequests()[1]?.body).toEqual({
      name: "thinking",
      projectPath: "/repo/app",
      toolName: "sequentialthinking",
      arguments: {
        thought: "test",
        nextThoughtNeeded: false,
        thoughtNumber: 1,
        totalThoughts: 1,
      },
    });
  });

  test("Scenario: Given MCP CLI probe input When probe executes Then it posts descriptor-backed JSON to runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/mcp/probe": {
        result: {
          command: "mcp probe",
          stdin: '{\n  "action": "ping",\n  "probeId": "probe-1"\n}',
          stdout: "{}\n",
          stderr: "",
          exitCode: 0,
          parsed: {},
        },
      },
    });
    const mcp = createRuntimeCommand(api.baseUrl, "mcp");

    const result = await mcp.execute(
      ["probe"],
      createCommandContext(
        JSON.stringify({
          action: "ping",
          probeId: "probe-1",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"command": "mcp probe"');
    expect(result.stdout).toContain('"stdout": "{}\\n"');
    expect(api.getRequests().map((request) => request.url)).toEqual(["/v1/mcp/probe"]);
    expect(api.getRequests()[0]?.body).toEqual({
      action: "ping",
      probeId: "probe-1",
    });
  });

  test("Scenario: Given descriptor help probe When terminal input --help runs Then the mixed-mode contract is returned locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["input", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Write mixed terminal input through the pending queue.");
    expect(result.stdout).toContain('"terminalId"');
    expect(result.stdout).toContain('"text"');
    expect(result.stdout).toContain("command: `terminal input`");
    expect(result.stdout).toContain("<key .../>");
    expect(result.stdout).toContain("<wait .../>");
    expect(result.stdout).toContain("<raw>...</raw>");
    expect(result.stdout).toContain('ctrl="true"');
    expect(result.stdout).toContain('<key data="d" ctrl="true"/>');
    expect(result.stdout).toContain("For a Guard actor");
    expect(result.stdout).toContain("createApprovalRequest:true");
    expect(result.stdout).toContain("approvalRequest");
    expect(result.stdout).toContain("mixed input did not reach the PTY yet");
    expect(result.stdout).toContain("terminal-local approval");
    expect(result.stdout).toContain("root_bash");
    expect(result.stdout).toContain("workspace_bash");
    expect(result.stdout).toContain("Denied or expired approval");
    expect(result.stdout).toContain("duplicate work");
    expect(result.stdout).toContain("skill info agenter-terminal");
    expect(result.stdout).toContain("references/input-modes.md");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given descriptor help probe When terminal read --help runs Then cursor consumption controls are documented locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["read", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Read terminal output using auto, diff, or snapshot mode.");
    expect(result.stdout).toContain('"terminalId"');
    expect(result.stdout).toContain('"mode"');
    expect(result.stdout).toContain('"remark"');
    expect(result.stdout).toContain('"recordActivity"');
    expect(result.stdout).toContain("consumes this session actor's read cursor");
    expect(result.stdout).toContain("Other actors keep their own cursor");
    expect(result.stdout).toContain("`remark:false` performs non-consuming inspection");
    expect(result.stdout).toContain("does not advance this actor's read cursor");
    expect(result.stdout).toContain("`recordActivity:false` suppresses activity history");
    expect(result.stdout).toContain("independent from cursor consumption");
    expect(result.stdout).toContain("Availability: Suggested");
    expect(result.stdout).toContain("[2] recordActivity?: boolean");
    expect(result.stdout).toContain("[3] remark?: boolean");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given descriptor help probe When terminal await --help runs Then schema-backed bounded observation help is returned locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const awaitHelp = await terminal.execute(["await", "--help"], createCommandContext());
    const readHelp = await terminal.execute(["read", "--help"], createCommandContext());

    expect(awaitHelp.exitCode).toBe(0);
    expect(awaitHelp.stdout).toContain("Wait for bounded terminal evidence");
    expect(awaitHelp.stdout).toContain('"wait"');
    expect(awaitHelp.stdout).toContain('"match"');
    expect(awaitHelp.stdout).toContain('"view"');
    expect(awaitHelp.stdout).toContain('"timeoutMs"');
    expect(awaitHelp.stdout).toContain('"idleMs"');
    expect(awaitHelp.stdout).toContain("stable clean snapshot lines");
    expect(awaitHelp.stdout).toContain("Shell-level timeout may cancel");
    expect(readHelp.stdout).not.toContain('"wait"');
    expect(readHelp.stdout).not.toContain('"timeoutMs"');
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given a shell abort signal When terminal await is in flight Then the CLI cancels the runtime request", async () => {
    let requestClosed = false;
    const server = createServer((request, _response) => {
      request.resume();
      request.once("close", () => {
        requestClosed = true;
      });
    });
    openServers.push(server);
    await new Promise<void>((resolveReady, rejectReady) => {
      server.once("error", rejectReady);
      server.listen(0, "127.0.0.1", () => resolveReady());
    });
    const address = server.address();
    if (!address || typeof address !== "object") {
      throw new Error("expected mock runtime api address");
    }
    const terminal = createRuntimeCommand(`http://127.0.0.1:${address.port}`, "terminal");
    const abort = new AbortController();

    const pending = terminal.execute(
      ["await"],
      createCommandContext(
        JSON.stringify({
          terminalId: "term-1",
          wait: {
            until: "changed",
            timeoutMs: 60_000,
          },
        }),
        abort.signal,
      ),
    );
    await Bun.sleep(20);
    abort.abort();
    const result = await pending;
    for (let index = 0; index < 20 && !requestClosed; index += 1) {
      await Bun.sleep(10);
    }

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toLowerCase()).toContain("abort");
    expect(requestClosed).toBe(true);
  });

  test("Scenario: Given descriptor lifecycle help probes When terminal create bootstrap and set-config help run Then the CLI teaches auto-bootstrap transition waiting and config patch law locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const createHelp = await terminal.execute(["create", "--help"], createCommandContext());
    const bootstrapHelp = await terminal.execute(["bootstrap", "--help"], createCommandContext());
    const setConfigHelp = await terminal.execute(["set-config", "--help"], createCommandContext());

    expect(createHelp.exitCode).toBe(0);
    expect(createHelp.stdout).toContain("auto-bootstraps new terminals by default");
    expect(createHelp.stdout).toContain("lifecycleTransition = bootstrapping");

    expect(bootstrapHelp.exitCode).toBe(0);
    expect(bootstrapHelp.stdout).toContain("wait and reread `terminal list`");
    expect(bootstrapHelp.stdout).toContain("bootstrapping");
    expect(bootstrapHelp.stdout).toContain("killing");

    expect(setConfigHelp.exitCode).toBe(0);
    expect(setConfigHelp.stdout).toContain('"launchCwd"');
    expect(setConfigHelp.stdout).toContain("Geometry fields such as `cols` and `rows` may apply");
    expect(setConfigHelp.stdout).toContain("next bootstrap");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given descriptor help probes When stdin examples are rendered Then help prefers root_bash command plus stdin over heredoc shell snippets", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");
    const attention = createRuntimeCommand(api.baseUrl, "attention");

    const messageHelp = await message.execute(["send", "--help"], createCommandContext());
    const attentionHelp = await attention.execute(["commit", "--help"], createCommandContext());

    expect(messageHelp.exitCode).toBe(0);
    expect(messageHelp.stdout).toContain("Preferred default through `root_bash`");
    expect(messageHelp.stdout).toContain("command: `message send`");
    expect(messageHelp.stdout).not.toContain("cat <<'EOF'");
    expect(messageHelp.stdout.indexOf("Preferred default through `root_bash`")).toBeLessThan(
      messageHelp.stdout.indexOf("Single argv JSON fallback for trivial payloads"),
    );
    expect(messageHelp.stdout).toContain("Optional positional compact mode");
    expect(messageHelp.stdout).toContain("Availability: Available");
    expect(messageHelp.stdout).toContain('"ref"');
    expect(messageHelp.stdout).toContain('"followUpAfterMs"');
    expect(messageHelp.stdout).toContain("If recentMessages suggest an accidental duplicate");
    expect(messageHelp.stdout).toContain("use `message read` before `message edit` or `message recall`");
    expect(messageHelp.stdout).toContain("followUpAfterMs is an optional one-shot re-decision timer");
    expect(messageHelp.stdout).toContain("creates later attention only");

    expect(attentionHelp.exitCode).toBe(0);
    expect(attentionHelp.stdout).toContain("command: `attention commit`");
    expect(attentionHelp.stdout).toContain("stdin:");
    expect(attentionHelp.stdout).not.toContain("cat <<'EOF'");
    expect(attentionHelp.stdout).toContain('["update", value, format?] | ["diff", value, format?] | ["clean"]');
    expect(attentionHelp.stdout).not.toContain("message_reply");
    expect(attentionHelp.stdout).not.toContain("egress");
  });

  test("Scenario: Given explicit compact help markers When message send --compact --help runs Then local help still renders without calling the runtime API", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["send", "--compact", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("message send");
    expect(result.stdout).toContain("Compact positional mode:");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given non-JSON arguments When message send runs Then the CLI rejects them and points back to JSON help", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["send", "--room", "room-1", "--content", "hello"], createCommandContext());

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("message send requires exactly one JSON object payload source");
    expect(result.stderr).toContain("message send --help");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given namespace help probe When message --help runs Then subcommands are listed without calling the runtime API", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Available subcommands:");
    expect(result.stdout).toContain("query: Search authorized room history");
    expect(result.stdout).toContain("send: Send a durable room message");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given a non-canonical help flag When message -h runs Then the CLI rejects it as an unknown subcommand", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(["-h"], createCommandContext());

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown message subcommand: -h");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given namespace help probe When terminal --help runs Then bootstrap and stop are listed as canonical lifecycle subcommands", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("list: List live terminals visible to this runtime, including lifecycle");
    expect(result.stdout).toContain("get-config: Read one terminal's durable launch/config truth");
    expect(result.stdout).toContain("set-config: Patch one terminal's durable launch/config truth");
    expect(result.stdout).toContain("history: List killed terminal instances retained as history for this runtime.");
    expect(result.stdout).toContain(
      "bootstrap: Bootstrap a provisioned terminal, or explicitly recover a killed-history terminal by id.",
    );
    expect(result.stdout).toContain("stop: Stop a running runtime terminal PTY by id and move it into terminal history.");
    expect(result.stdout).toContain("archive: Archive a killed terminal history instance without deleting its retained evidence.");
    expect(result.stdout).not.toContain("kill: Kill a runtime terminal by id.");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given tool namespace help probe When tool --help runs Then helper discovery guidance is returned locally even with no built-in helpers", async () => {
    const api = await startMockRuntimeApi();
    const rootWorkspacePath = createTempRoot();
    createRuntimeShellCommands({
      baseUrl: api.baseUrl,
      privateKey: "test-private-key",
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });
    const tool = createRuntimeCommand(api.baseUrl, "tool", {
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });

    const result = await tool.execute(["--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tool <file>");
    expect(result.stdout).toContain("tool <file> --help");
    expect(result.stdout).toContain("Available files: none");
  });

  test("Scenario: Given the root workspace shell helpcenter When JSON listing is requested Then just-bash builtins and runtime CLI commands stay grouped in one catalog", async () => {
    const api = await startMockRuntimeApi();
    const helpcenter = createRuntimeCommand(api.baseUrl, "helpcenter", {
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
    });

    const result = await helpcenter.execute(["list", "--json"], createCommandContext());

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      groups: Array<{
        id: string;
        entries: Array<{ commandLabel: string }>;
      }>;
    };
    expect(payload.groups.map((group) => group.id)).toEqual(["just-bash-builtins", "root-runtime-cli"]);
    expect(payload.groups[0]?.entries.some((entry) => entry.commandLabel === "cd")).toBeTrue();
    expect(payload.groups[1]?.entries.some((entry) => entry.commandLabel === "message send")).toBeTrue();
    expect(payload.groups[1]?.entries.some((entry) => entry.commandLabel === "workspace list")).toBeTrue();
    expect(payload.groups[1]?.entries.some((entry) => entry.commandLabel === "mcp query")).toBeTrue();
  });

  test("Scenario: Given built-in skills When skill list runs Then the shell output teaches progressive discovery through real paths and references through the local API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/skill/list": {
        skills: [
          {
            name: "agenter-runtime",
            summary: "runtime shell guidance",
            path: "/repo/packages/app-server/skills/runtime/SKILL.md",
            root: "/repo/packages/app-server/skills/runtime",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
          {
            name: "agenter-mcp",
            summary: "Install, enable, query, call, and recover MCP servers through the root runtime CLI.",
            path: "/repo/packages/app-server/skills/mcp/SKILL.md",
            root: "/repo/packages/app-server/skills/mcp",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
        ],
      },
    });
    const skill = createRuntimeCommand(api.baseUrl, "skill", {
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
    });

    const result = await skill.execute(["list"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Use `skill info <skill>`");
    expect(result.stdout).toContain("real filesystem path");
    expect(result.stdout).toContain("references/*.md");
    expect(result.stdout).toContain("agenter-runtime");
    expect(result.stdout).toContain("agenter-mcp");
    expect(api.getLastRequest()?.url).toBe("/v1/skill/list");
  });

  test("Scenario: Given system CLI projections omit note When runtime shell commands are created Then note is not registered while skill remains projected", async () => {
    const api = await startMockRuntimeApi();
    const commands = createRuntimeShellCommands({
      baseUrl: api.baseUrl,
      privateKey: "test-private-key",
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
      cliProjections: [
        {
          command: "skill",
          systemId: "skillSystem",
          capability: "workspace-pwd",
          sourceEnv: "SKILLS_HOME",
          sourcePaths: ["/repo/skills"],
          workspacePath: "/repo",
        },
      ],
    });

    expect(commands.some((command) => command.name === "skill")).toBeTrue();
    expect(commands.some((command) => command.name === "note")).toBeFalse();
  });

  test("Scenario: Given skill info for the MCP skill When the shell command runs Then the MCP usage law is rendered from its built-in path", async () => {
    const api = await startMockRuntimeApi({
      "/v1/skill/info": {
        result: {
          skill: {
            name: "agenter-mcp",
            summary: "Install, enable, query, call, and recover MCP servers through the root runtime CLI.",
            path: "/repo/packages/app-server/skills/mcp/SKILL.md",
            root: "/repo/packages/app-server/skills/mcp",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
          content: [
            "# agenter-mcp",
            "",
            "Run `mcp --help` or `mcp <command> --help` before guessing an argument shape.",
            "`mcp query` always returns JSON rows.",
            "`mcp call` defaults are `autoStart: true` and `autoEnable: false`.",
          ].join("\n"),
        },
      },
    });
    const rootWorkspacePath = createTempRoot();
    const skill = createRuntimeCommand(api.baseUrl, "skill", {
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });

    const result = await skill.execute(["info", "agenter-mcp"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# agenter-mcp");
    expect(result.stdout).toContain("/repo/packages/app-server/skills/mcp/SKILL.md");
    expect(result.stdout).toContain("mcp --help");
    expect(result.stdout).toContain("always returns JSON rows");
    expect(existsSync(join(rootWorkspacePath, "skills", "agenter-mcp", "SKILL.md"))).toBeFalse();
    expect(api.getLastRequest()?.url).toBe("/v1/skill/info");
  });

  test("Scenario: Given skill info for a built-in skill When the shell command runs Then the real SKILL path and reference index are rendered without materializing built-ins into workspace storage", async () => {
    const api = await startMockRuntimeApi({
      "/v1/skill/info": {
        result: {
          skill: {
            name: "agenter-runtime",
            summary: "runtime shell guidance",
            path: "/repo/packages/app-server/skills/runtime/SKILL.md",
            root: "/repo/packages/app-server/skills/runtime",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
          content: [
            "# agenter-runtime",
            "",
            "References:",
            "- `references/discovery.md`",
            "- `references/shell-surface.md`",
          ].join("\n"),
        },
      },
    });
    const rootWorkspacePath = createTempRoot();
    const skill = createRuntimeCommand(api.baseUrl, "skill", {
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });

    const result = await skill.execute(["info", "agenter-runtime"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`# agenter-runtime`);
    expect(result.stdout).toContain("Path:");
    expect(result.stdout).toContain("/repo/packages/app-server/skills/runtime/SKILL.md");
    expect(result.stdout).toContain("References:");
    expect(result.stdout).toContain("references/discovery.md");
    expect(result.stdout).toContain("references/shell-surface.md");
    expect(existsSync(join(rootWorkspacePath, "skills", "agenter-runtime", "SKILL.md"))).toBeFalse();
    expect(api.getLastRequest()?.url).toBe("/v1/skill/info");
  });

  test("Scenario: Given skill get-config for a built-in skill When the shell command runs Then watcher metadata is rendered without exposing arbitrary sibling contents", async () => {
    const api = await startMockRuntimeApi({
      "/v1/skill/get-config": {
        result: {
          skill: {
            name: "agenter-runtime",
            summary: "runtime shell guidance",
            path: "/repo/packages/app-server/skills/runtime/SKILL.md",
            root: "/repo/packages/app-server/skills/runtime",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
          writable: false,
          skillDir: "/repo/packages/app-server/skills/runtime",
          skillPath: "/repo/packages/app-server/skills/runtime/SKILL.md",
          configPath: "/repo/packages/app-server/skills/runtime/ccski.config.json",
          configExists: true,
          config: {
            files: ["references/*.md"],
          },
          configError: null,
          resolvedWatchTargets: [
            "/repo/packages/app-server/skills/runtime/SKILL.md",
            "/repo/packages/app-server/skills/runtime/ccski.config.json",
            "/repo/packages/app-server/skills/runtime/references/discovery.md",
          ],
        },
      },
    });
    const skill = createRuntimeCommand(api.baseUrl, "skill", {
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
    });

    const result = await skill.execute(["get-config", "agenter-runtime", "builtin"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Config path:");
    expect(result.stdout).toContain("Resolved watch targets:");
    expect(result.stdout).toContain("references/*.md");
    expect(result.stdout).toContain("ccski.config.json");
    expect(api.getLastRequest()?.body).toEqual({
      name: "agenter-runtime",
      rootKind: "builtin",
    });
  });

  test("Scenario: Given JSON stdin When skill set-config runs Then the CLI posts the full replacement config payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/skill/set-config": {
        result: {
          skills: [],
          snapshot: "## skills.list",
          changedSkills: [
            {
              name: "agenter-runtime",
              kind: "updated",
              rootKind: "builtin",
              changedFiles: ["/repo/packages/app-server/skills/runtime/ccski.config.json"],
            },
          ],
          publishedCommitIds: ["commit-1"],
          skill: {
            name: "agenter-runtime",
            summary: "runtime shell guidance",
            path: "/repo/packages/app-server/skills/runtime/SKILL.md",
            root: "/repo/packages/app-server/skills/runtime",
            rootKind: "builtin",
            writable: false,
            packageName: "@agenter/app-server",
          },
        },
      },
    });
    const skill = createRuntimeCommand(api.baseUrl, "skill", {
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
    });

    const result = await skill.execute(
      ["set-config"],
      createCommandContext(
        JSON.stringify({
          name: "agenter-runtime",
          rootKind: "builtin",
          config: {
            files: ["references/*.md"],
          },
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      name: "agenter-runtime",
      rootKind: "builtin",
      config: {
        files: ["references/*.md"],
      },
    });
  });

  test("Scenario: Given runtime shell bootstrap When commands are created Then the built-in helper directory stays empty by default", async () => {
    const api = await startMockRuntimeApi();
    const rootWorkspacePath = createTempRoot();

    createRuntimeShellCommands({
      baseUrl: api.baseUrl,
      privateKey: "test-private-key",
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });

    expect(existsSync(join(rootWorkspacePath, "tools", "serve-static.ts"))).toBeFalse();
  });

  test("Scenario: Given a local js-exec helper tool When --help is requested Then the tool command executes the real script instead of descriptor help", async () => {
    const api = await startMockRuntimeApi();
    const rootWorkspacePath = createTempRoot();
    const toolRoot = join(rootWorkspacePath, "tools");
    mkdirSync(toolRoot, { recursive: true });
    writeFileSync(
      join(toolRoot, "local-helper.ts"),
      [
        "#!/usr/bin/env bun",
        "const isHelp = process.argv.slice(2).some((arg) => arg === '--help' || arg === '-h' || arg === 'help');",
        "if (isHelp) {",
        "  console.log('local-helper.ts');",
        "  console.log('Description: local helper');",
        "} else {",
        "  console.log('local-helper-run');",
        "}",
      ].join("\n"),
      "utf8",
    );
    const tool = createRuntimeCommand(api.baseUrl, "tool", {
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });
    let capturedCommand = "";
    let capturedArgs: string[] = [];
    let didCapture = false;

    const result = await tool.execute(["local-helper.ts", "--help"], {
      ...createCommandContext(),
      exec: async (command: string, options: { args?: string[] }) => {
        capturedCommand = command;
        capturedArgs = options.args ?? [];
        didCapture = true;
        return {
          stdout: "local-helper.ts\nDescription: local helper\n",
          stderr: "",
          exitCode: 0,
        };
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("local-helper.ts");
    expect(result.stdout).toContain("Description: local helper");
    expect(didCapture).toBeTrue();
    expect(capturedCommand).not.toBe("");
    expect(capturedArgs).toEqual([]);
  });
});
