import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import { createRuntimeShellCommands } from "../src/runtime-cli";
import { executeRootWorkspaceBash } from "../src/workspace-system/root-exec";

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

const createCommandContext = (stdin = "") => ({
  fs: new InMemoryFs(),
  cwd: "/",
  env: new Map(),
  stdin,
});

describe("Feature: runtime descriptor CLI", () => {
  test("Scenario: Given JSON argv When message send runs Then the CLI posts the validated descriptor payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/send": { result: { ok: true, messageId: "msg-1" } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["send", '{"chatId":"room-1","content":"APP-ACK: 开始构建"}'],
      createCommandContext(),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()).toEqual({
      url: "/v1/message/send",
      headers: expect.objectContaining({
        "x-agenter-principal-key": "test-private-key",
      }),
      body: {
        chatId: "room-1",
        content: "APP-ACK: 开始构建",
      },
    });
  });

  test("Scenario: Given JSON stdin When message edit runs Then the CLI posts the validated edit payload to the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/edit": { result: { ok: true, messageId: "msg-1", updatedAt: 42 } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["edit"],
      createCommandContext(
        JSON.stringify({
          chatId: "room-1",
          messageId: "msg-1",
          content: "Correction: use /preview/42 instead.",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      messageId: "msg-1",
      content: "Correction: use /preview/42 instead.",
    });
  });

  test("Scenario: Given JSON stdin When message recall runs Then the CLI posts the validated recall payload to the runtime API", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/recall": { result: { ok: true, messageId: "msg-1", updatedAt: 42, recalledAt: 42 } },
    });
    const message = createRuntimeCommand(api.baseUrl, "message");

    const result = await message.execute(
      ["recall"],
      createCommandContext(
        JSON.stringify({
          chatId: "room-1",
          messageId: "msg-1",
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      chatId: "room-1",
      messageId: "msg-1",
    });
  });

  test("Scenario: Given explicit compact argv When terminal kill runs Then the CLI decodes the positional payload back into the descriptor object", async () => {
    const api = await startMockRuntimeApi({
      "/v1/terminal/kill": { result: { ok: true, message: "killed" } },
    });
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["kill", "--compact", '["term-1"]'], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({
      terminalId: "term-1",
    });
  });

  test("Scenario: Given root workspace bash expands a UTF-8 JSON payload When message send forwards the heredoc argv Then the runtime API preserves the original Unicode content", async () => {
    const api = await startMockRuntimeApi({
      "/v1/message/send": { result: { ok: true, messageId: "msg-utf8" } },
    });
    const rootWorkspacePath = createTempRoot();

    const result = await executeRootWorkspaceBash({
      rootWorkspacePath,
      command: [
        "cat << 'PAYLOAD' > msg_payload.json",
        '{"chatId":"room-1","content":"你好！有什么可以帮你的吗？😊"}',
        "PAYLOAD",
        'message send "$(cat msg_payload.json)"',
      ].join("\n"),
      mounts: [],
      customCommands: createRuntimeShellCommands({
        baseUrl: api.baseUrl,
        privateKey: "test-private-key",
        rootWorkspacePath,
        homeDir: rootWorkspacePath,
      }),
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

  test("Scenario: Given empty input list command When workspace list runs Then the CLI sends an empty descriptor payload", async () => {
    const api = await startMockRuntimeApi({
      "/v1/workspace/list": { workspaces: [] },
    });
    const workspace = createRuntimeCommand(api.baseUrl, "workspace");

    const result = await workspace.execute(["list"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(api.getLastRequest()?.body).toEqual({});
  });

  test("Scenario: Given descriptor help probe When terminal write --help runs Then schema-backed help is returned locally", async () => {
    const api = await startMockRuntimeApi();
    const terminal = createRuntimeCommand(api.baseUrl, "terminal");

    const result = await terminal.execute(["write", "--help"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Write text into a terminal and optionally submit it.");
    expect(result.stdout).toContain('"terminalId"');
    expect(result.stdout).toContain('"text"');
    expect(result.stdout).toContain("Preferred default through `root_workspace_bash`");
    expect(result.stdout).toContain("command: `terminal write`");
    expect(result.stdout).toContain("stdin:");
    expect(result.stdout).toContain("Single argv JSON fallback for trivial payloads");
    expect(result.stdout).toContain("Compact positional mode:");
    expect(result.stdout).toContain("Availability: Suggested");
    expect(result.stdout).toContain('[0] terminalId: string');
    expect(result.stdout).toContain('[1] text: string');
    expect(result.stdout).not.toContain("cat <<'EOF'");
    expect(result.stdout).toContain("Default to JSON stdin");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given descriptor help probes When stdin examples are rendered Then help prefers root_workspace_bash command plus stdin over heredoc shell snippets", async () => {
    const api = await startMockRuntimeApi();
    const message = createRuntimeCommand(api.baseUrl, "message");
    const attention = createRuntimeCommand(api.baseUrl, "attention");

    const messageHelp = await message.execute(["send", "--help"], createCommandContext());
    const attentionHelp = await attention.execute(["commit", "--help"], createCommandContext());

    expect(messageHelp.exitCode).toBe(0);
    expect(messageHelp.stdout).toContain("Preferred default through `root_workspace_bash`");
    expect(messageHelp.stdout).toContain("command: `message send`");
    expect(messageHelp.stdout).not.toContain("cat <<'EOF'");
    expect(messageHelp.stdout.indexOf("Preferred default through `root_workspace_bash`")).toBeLessThan(
      messageHelp.stdout.indexOf("Single argv JSON fallback for trivial payloads"),
    );
    expect(messageHelp.stdout).toContain("Optional positional compact mode");
    expect(messageHelp.stdout).toContain("Availability: Available");

    expect(attentionHelp.exitCode).toBe(0);
    expect(attentionHelp.stdout).toContain("command: `attention commit`");
    expect(attentionHelp.stdout).toContain("stdin:");
    expect(attentionHelp.stdout).not.toContain("cat <<'EOF'");
    expect(attentionHelp.stdout).toContain('["update", value, format?] | ["diff", value, format?] | ["clean"]');
    expect(attentionHelp.stdout).toContain('[3] egress?: ["message_reply", chatId, rootId?, from?, to?]');
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

    const result = await message.execute(
      ["send", "--room", "room-1", "--content", "hello"],
      createCommandContext(),
    );

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

  test("Scenario: Given built-in skills When ccski list runs Then the shell output teaches progressive discovery through real paths and references", async () => {
    const api = await startMockRuntimeApi();
    const ccski = createRuntimeCommand(api.baseUrl, "ccski", {
      rootWorkspacePath: createTempRoot(),
      homeDir: createTempRoot(),
    });

    const result = await ccski.execute(["list"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Use `ccski info <skill>`");
    expect(result.stdout).toContain("real filesystem path");
    expect(result.stdout).toContain("references/*.md");
    expect(result.stdout).toContain("agenter-runtime");
    expect(api.getRequests()).toHaveLength(0);
  });

  test("Scenario: Given ccski info for a built-in skill When the shell command runs Then the real SKILL path and reference index are rendered without materializing built-ins into workspace storage", async () => {
    const api = await startMockRuntimeApi();
    const rootWorkspacePath = createTempRoot();
    const ccski = createRuntimeCommand(api.baseUrl, "ccski", {
      rootWorkspacePath,
      homeDir: createTempRoot(),
    });

    const result = await ccski.execute(["info", "agenter-runtime"], createCommandContext());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`# agenter-runtime`);
    expect(result.stdout).toContain("Path:");
    expect(result.stdout).toContain(`${rootWorkspacePath}/.runtime-skills/agenter-runtime/SKILL.md`);
    expect(result.stdout).toContain("References:");
    expect(result.stdout).toContain("references/discovery.md");
    expect(result.stdout).toContain("references/shell-surface.md");
    expect(existsSync(join(rootWorkspacePath, "skills", "agenter-runtime", "SKILL.md"))).toBeFalse();
    expect(api.getRequests()).toHaveLength(0);
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
