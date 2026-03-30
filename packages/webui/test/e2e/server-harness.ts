import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { parse as parseYaml } from "yaml";
import type { AppKernel } from "../../../app-server/src/index";

import {
  canProxyRealModelConfig,
  resolveRealModelConfig,
  startCachedRealModelProxy,
  type RealModelConfig,
} from "../../../app-server/test-support/real-model-cache";
import { SessionDb } from "../../../session-system/src/session-db";
import { startTrpcServer } from "../../../cli/src/trpc-server";
import { E2E_FIXTURE_PATH } from "./fixture-path";

const DEFAULT_HOST = "127.0.0.1";
const MOCK_REPLY = "PLAYWRIGHT-MOCK-REPLY";

interface MockChatRequestMessage {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
}

interface MockChatRequestBody {
  messages?: MockChatRequestMessage[];
}

interface MockAttentionContextDocument {
  contextId?: string;
  context?: {
    contextId?: string;
    owner?: string;
    content?: string;
    scoreMap?: Record<string, number>;
    headCommitId?: string | null;
  };
  recentCommits?: Array<{
    summary?: string;
    meta?: {
      source?: string;
      chatId?: string;
      channelId?: string | null;
      content?: string;
    };
  }>;
}

const parseChatRequestBody = (body: string): MockChatRequestBody | null => {
  try {
    return JSON.parse(body) as MockChatRequestBody;
  } catch {
    return null;
  }
};

const flattenMessageContent = (content: MockChatRequestMessage["content"]): string => {
  if (typeof content === "string") {
    return content;
  }
  return (content ?? []).map((part) => (part?.type === "text" ? part.text ?? "" : "")).join("");
};

const extractAttentionContexts = (body: string): MockAttentionContextDocument[] => {
  const parsed = parseChatRequestBody(body);
  if (!parsed?.messages?.length) {
    return [];
  }
  const docs: MockAttentionContextDocument[] = [];
  for (const message of parsed.messages) {
    if (message.role !== "user") {
      continue;
    }
    const text = flattenMessageContent(message.content);
    for (const match of text.matchAll(/```yaml\+attention_context\n([\s\S]*?)```/g)) {
      const source = match[1]?.trim();
      if (!source) {
        continue;
      }
      try {
        docs.push(parseYaml(source) as MockAttentionContextDocument);
      } catch {
        // ignore malformed blocks in the mock harness
      }
    }
  }
  return docs;
};

const requestContainsToolRound = (body: string): boolean =>
  parseChatRequestBody(body)?.messages?.some((message) => message.role === "tool") ?? false;

const hasPositiveScores = (scoreMap: Record<string, number> | undefined): boolean =>
  Object.values(scoreMap ?? {}).some((value) => Number.isFinite(value) && value > 0);

const zeroScores = (scoreMap: Record<string, number> | undefined): Record<string, number> =>
  Object.fromEntries(
    Object.entries(scoreMap ?? {})
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([hash]) => [hash, 0]),
  );

const resolvePromptFromContext = (context: MockAttentionContextDocument): string | null => {
  const recentMessage = [...(context.recentCommits ?? [])]
    .reverse()
    .find((commit) => commit.meta?.source === "message" && typeof commit.meta.content === "string");
  return recentMessage?.meta?.content ?? context.context?.content ?? context.recentCommits?.at(-1)?.summary ?? null;
};

const resolveMockReply = (prompt: string | null): string => {
  if (!prompt) {
    return MOCK_REPLY;
  }
  if (prompt.includes("[lunch-return]")) {
    return "gaubee 说中午吃蛋炒饭。";
  }
  if (prompt.includes("[lunch-relay]")) {
    return "中午吃蛋炒饭。";
  }
  if (prompt.includes("[lunch-main]")) {
    return "稍等，我去问一下。";
  }
  if (prompt.includes("gaubee在吗？问他中午吃什么")) {
    return "稍等，我去问一下。";
  }
  if (prompt.includes("在吗？kzf 问你中午吃什么")) {
    return "中午吃蛋炒饭。";
  }
  if (prompt.includes("转达给 kzf") || prompt.includes("转达给kzf")) {
    return "gaubee 说中午吃蛋炒饭。";
  }
  return MOCK_REPLY;
};

const resolveChatId = (context: MockAttentionContextDocument): string | null => {
  const recent = [...(context.recentCommits ?? [])].reverse();
  for (const commit of recent) {
    const chatId = commit.meta?.chatId ?? commit.meta?.channelId ?? null;
    if (chatId) {
      return chatId;
    }
  }
  const contextId = context.context?.contextId ?? context.contextId ?? "";
  return contextId.startsWith("ctx-chat-") ? `chat-${contextId.slice("ctx-chat-".length)}` : null;
};

const createMockToolCall = (id: string, name: string, input: unknown) => ({
  id,
  type: "function" as const,
  function: {
    name,
    arguments: JSON.stringify(input),
  },
});

const buildMockToolCalls = (body: string) => {
  if (requestContainsToolRound(body)) {
    return [];
  }

  const contexts = extractAttentionContexts(body).filter((context) => hasPositiveScores(context.context?.scoreMap));
  if (contexts.length === 0) {
    return [];
  }

  const toolCalls: Array<ReturnType<typeof createMockToolCall>> = [];

  for (const context of contexts) {
    const contextId = context.context?.contextId ?? context.contextId;
    if (!contextId) {
      continue;
    }

    const parentCommitIds = context.context?.headCommitId ? [context.context.headCommitId] : [];
    const scores = zeroScores(context.context?.scoreMap);
    if (Object.keys(scores).length === 0) {
      continue;
    }

    if (contextId.startsWith("ctx-chat-")) {
      const prompt = resolvePromptFromContext(context);
      const reply = resolveMockReply(prompt);
      const chatId = resolveChatId(context);
      if (chatId) {
        toolCalls.push(
          createMockToolCall(`call-message-send-${chatId}`, "message_send", {
            chatId,
            content: reply,
          }),
        );
      }
      toolCalls.push(
        createMockToolCall(`call-attention-commit-${contextId}`, "attention_commit", {
          contextId,
          parentCommitIds,
          meta: {
            author: "assistant",
            source: "attention",
            systemId: "message",
            subjectId: chatId ?? contextId,
            channelId: chatId ?? undefined,
          },
          scores,
          summary: `Resolved ${contextId}`,
          change: {
            type: "update",
            value: reply,
            format: "text/plain",
          },
          stage: "done",
          done: true,
        }),
      );
      continue;
    }

    const systemId = contextId.startsWith("ctx-terminal-") ? "terminal" : "attention";
    const subjectId = contextId.startsWith("ctx-terminal-") ? contextId.slice("ctx-terminal-".length) : contextId;
    toolCalls.push(
      createMockToolCall(`call-attention-commit-${contextId}`, "attention_commit", {
        contextId,
        parentCommitIds,
        meta: {
          author: "assistant",
          source: "attention",
          systemId,
          subjectId,
        },
        scores,
        summary: `Resolved ${contextId}`,
        change: {
          type: "update",
          value: context.context?.content ?? `Resolved ${contextId}`,
          format: "text/plain",
        },
        stage: "observe",
        done: false,
      }),
    );
  }

  return toolCalls;
};

export interface E2EServerHarness {
  baseUrl: string;
  mockReply: string;
  modelMode: "mock" | "real";
  stop: () => Promise<void>;
}

interface HarnessPorts {
  host: string;
  webPort: number;
  trpcPort: number;
  modelPort: number;
}

const readRequestBody = async (request: import("node:http").IncomingMessage): Promise<string> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const waitForHttpServer = async (url: string, timeoutMs = 30_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // keep polling until the timeout
    }
    await Bun.sleep(200);
  }
  throw new Error(`server did not become ready: ${url}`);
};

const findFreePort = async (host: string): Promise<number> =>
  await new Promise<number>((resolveReady, rejectReady) => {
    const server = createNetServer();
    server.once("error", rejectReady);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectReady(new Error("failed to allocate port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          rejectReady(error);
          return;
        }
        resolveReady(port);
      });
    });
  });

const allocatePorts = async (host: string): Promise<HarnessPorts> => {
  const used = new Set<number>();
  const takePort = async (): Promise<number> => {
    while (true) {
      const port = await findFreePort(host);
      if (!used.has(port)) {
        used.add(port);
        return port;
      }
    }
  };

  return {
    host,
    webPort: await takePort(),
    trpcPort: await takePort(),
    modelPort: await takePort(),
  };
};

const createMockModelServer = async (host: string, modelPort: number) => {
  const server = createHttpServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      const body = await readRequestBody(request);
      const toolCalls = buildMockToolCalls(body);
      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          id: "mock-chat-completion",
          choices: [
            {
              finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
              message: {
                role: "assistant",
                content: "",
                reasoning_content: toolCalls.length > 0 ? "Resolve attention by dispatching the reply and clearing scores." : "",
                tool_calls: toolCalls,
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4,
            total_tokens: 16,
          },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(modelPort, host, () => resolve());
  });

  return server;
};

interface ModelServerHarness {
  mode: "mock" | "real";
  provider: {
    apiStandard: RealModelConfig["apiStandard"];
    vendor: string;
    model: string;
    apiKey: string;
    baseUrl: string;
    profile?: string;
    headers?: Record<string, string>;
  };
  stop: () => Promise<void>;
}

const startModelServerHarness = async (host: string, modelPort: number): Promise<ModelServerHarness> => {
  const realConfig = resolveRealModelConfig(resolve(import.meta.dir, "../../../.."));
  if (realConfig && canProxyRealModelConfig(realConfig)) {
    const realProxy = await startCachedRealModelProxy({
      host,
      port: modelPort,
      config: realConfig,
    });
    return {
      mode: "real",
      provider: {
        apiStandard: realProxy.config.apiStandard,
        vendor: realProxy.config.vendor,
        model: realProxy.config.model,
        apiKey: "local-cache",
        baseUrl: `http://${host}:${modelPort}`,
        profile: realProxy.config.profile,
        headers: realProxy.config.headers,
      },
      stop: realProxy.stop,
    };
  }

  if (realConfig) {
    return {
      mode: "real",
      provider: {
        apiStandard: realConfig.apiStandard,
        vendor: realConfig.vendor,
        model: realConfig.model,
        apiKey: realConfig.apiKey,
        baseUrl: realConfig.baseUrl,
        profile: realConfig.profile,
        headers: realConfig.headers,
      },
      stop: async () => {},
    };
  }

  const server = await createMockModelServer(host, modelPort);
  return {
    mode: "mock",
    provider: {
      apiStandard: "openai-chat",
      vendor: "mock",
      model: "mock-chat",
      apiKey: "test-key",
      baseUrl: `http://${host}:${modelPort}`,
    },
    stop: async () => {
      await new Promise<void>((resolveStop, rejectStop) => {
        server.close((error) => {
          if (error) {
            rejectStop(error);
            return;
          }
          resolveStop();
        });
      });
    },
  };
};

const startWebDevServer = async (ports: HarnessPorts): Promise<ReturnType<typeof Bun.spawn>> => {
  const proc = Bun.spawn({
    cmd: [Bun.which("bun") ?? process.execPath, "run", "dev", "--host", ports.host, "--port", String(ports.webPort)],
    cwd: join(import.meta.dir, "../.."),
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      VITE_AGENTER_WS_URL: `ws://${ports.host}:${ports.trpcPort}/trpc`,
    },
  });
  await waitForHttpServer(`http://${ports.host}:${ports.webPort}`);
  return proc;
};

const createWorkspaceFixture = async (
  ports: HarnessPorts,
  modelProvider: ModelServerHarness["provider"],
): Promise<{
  root: string;
  workspacePath: string;
  attachmentPath: string;
  workspacesPath: string;
  globalSessionRoot: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "agenter-webui-e2e-"));
  const workspacePath = join(root, "workspace");
  const attachmentPath = join(workspacePath, "notes.txt");
  const workspacesPath = join(root, "workspaces.yaml");
  const globalSessionRoot = join(root, "sessions");

  await mkdir(join(workspacePath, ".agenter"), { recursive: true });
  await mkdir(globalSessionRoot, { recursive: true });
  await writeFile(
    join(workspacePath, ".agenter", "settings.json"),
    JSON.stringify(
      {
        ai: {
          activeProvider: "e2e-openai-chat",
          providers: {
            "e2e-openai-chat": {
              apiStandard: modelProvider.apiStandard,
              vendor: modelProvider.vendor,
              profile: modelProvider.profile,
              headers: modelProvider.headers,
              model: modelProvider.model,
              apiKey: modelProvider.apiKey,
              baseUrl: modelProvider.baseUrl,
            },
          },
        },
        features: {
          terminal: {
            bootTerminals: [],
          },
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    workspacesPath,
    [
      "version: 2",
      `updatedAt: ${new Date().toISOString()}`,
      "workspaces:",
      `  - ${JSON.stringify(workspacePath)}`,
      "favoriteWorkspaces:",
      `  - ${JSON.stringify(workspacePath)}`,
      "favoriteSessions:",
      "",
    ].join("\n"),
  );
  await writeFile(join(workspacePath, "README.md"), "# Playwright Workspace\n");
  await writeFile(attachmentPath, "E2E attachment content\n");
  return {
    root,
    workspacePath,
    attachmentPath,
    workspacesPath,
    globalSessionRoot,
  };
};

const seedPersistedHistorySession = async (
  kernel: AppKernel,
  input: { workspacePath: string; attachmentPath: string; turns?: number },
): Promise<{ sessionId: string; sessionName: string; turns: number }> => {
  const turns = input.turns ?? 14;
  const session = await kernel.createSession({
    cwd: input.workspacePath,
    name: "Persisted history fixture",
  });
  const assetBytes = new Uint8Array(await readFile(input.attachmentPath));
  const [attachment] = await kernel.uploadSessionAssets(session.id, [
    {
      name: "notes.txt",
      mimeType: "text/plain",
      bytes: assetBytes,
    },
  ]);

  const db = new SessionDb(join(session.sessionRoot, "session.db"));
  try {
    const baseTimestamp = Date.now() - turns * 120_000;
    let prevCycleId: number | null = null;
    let headCycleId: number | null = null;

    for (let turn = 1; turn <= turns; turn += 1) {
      const cycleTimestamp = baseTimestamp + (turn - 1) * 120_000;
      const prompt = `History prompt ${turn}: confirm the long persisted conversation turn ${turn}.`;
      const reply = `History reply ${turn}: completed the visible conversation turn ${turn}.`;
      const cycle = db.appendCycle({
        prevCycleId,
        createdAt: cycleTimestamp,
        wake: { source: "e2e-history" },
        collectedInputs: [
          {
            source: "message",
            sourceId: `history-user-${turn}`,
            role: "user",
            name: "History prompt",
            parts: [{ type: "text", text: prompt }],
            meta: {
              chatId: "chat-main",
            },
          },
        ],
        extendsRecord: {
          seededBy: "playwright",
        },
        result: {
          status: "done",
        },
      });
      prevCycleId = cycle.id;
      headCycleId = cycle.id;

      const userBlock = db.appendBlock({
        cycleId: cycle.id,
        createdAt: cycleTimestamp,
        role: "user",
        channel: "user_input",
        format: "markdown",
        content: prompt,
      });
      if (turn === 1 && attachment) {
        db.linkBlockAssets(userBlock.id, [attachment.assetId]);
      }
      db.appendBlock({
        cycleId: cycle.id,
        createdAt: cycleTimestamp + 60_000,
        role: "assistant",
        channel: "to_user",
        format: "markdown",
        content: reply,
      });
    }

    db.setHead(headCycleId, baseTimestamp + turns * 120_000);
  } finally {
    db.close();
  }

  return {
    sessionId: session.id,
    sessionName: session.name,
    turns,
  };
};

export const startE2EServerHarness = async (host = process.env.PLAYWRIGHT_WEB_HOST ?? DEFAULT_HOST): Promise<E2EServerHarness> => {
  const ports = await allocatePorts(host);
  const modelServer = await startModelServerHarness(ports.host, ports.modelPort);
  const fixture = await createWorkspaceFixture(ports, modelServer.provider);
  const trpc = await startTrpcServer({
    host: ports.host,
    port: ports.trpcPort,
    workspaceCwd: fixture.workspacePath,
    globalSessionRoot: fixture.globalSessionRoot,
    workspacesPath: fixture.workspacesPath,
  });
  const historySession = await seedPersistedHistorySession(trpc.kernel, {
    workspacePath: fixture.workspacePath,
    attachmentPath: fixture.attachmentPath,
    turns: 14,
  });
  await writeFile(
    E2E_FIXTURE_PATH,
    JSON.stringify(
      {
        workspacePath: fixture.workspacePath,
        attachmentPath: fixture.attachmentPath,
        mockReply: MOCK_REPLY,
        modelMode: modelServer.mode,
        historySessionId: historySession.sessionId,
        historySessionName: historySession.sessionName,
        historyTurns: historySession.turns,
      },
      null,
      2,
    ),
  );
  const webDev = await startWebDevServer(ports);

  return {
    baseUrl: `http://${ports.host}:${ports.webPort}`,
    mockReply: MOCK_REPLY,
    modelMode: modelServer.mode,
    stop: async () => {
      webDev.kill();
      await webDev.exited;
      await trpc.stop();
      await modelServer.stop();
      await rm(fixture.root, { recursive: true, force: true });
      await rm(E2E_FIXTURE_PATH, { force: true });
    },
  };
};
