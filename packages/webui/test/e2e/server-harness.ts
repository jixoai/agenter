import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { AppKernel } from "@agenter/app-server";

import { startTrpcServer } from "../../../cli/src/trpc-server";
import { E2E_FIXTURE_PATH } from "./fixture-path";

const DEFAULT_HOST = "127.0.0.1";
const MOCK_REPLY = "PLAYWRIGHT-MOCK-REPLY";

export interface E2EServerHarness {
  baseUrl: string;
  mockReply: string;
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

const waitForValue = async <T>(read: () => T | null, timeoutMs = 30_000): Promise<T> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = read();
    if (value !== null) {
      return value;
    }
    await Bun.sleep(150);
  }
  throw new Error("timed out while waiting for seeded long-history session");
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
      await readRequestBody(request);
      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          id: "mock-chat-completion",
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: MOCK_REPLY,
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

const startWebDevServer = async (ports: HarnessPorts): Promise<Subprocess> => {
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

const createWorkspaceFixture = async (ports: HarnessPorts): Promise<{
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
          activeProvider: "mock-openai-chat",
          providers: {
            "mock-openai-chat": {
              apiStandard: "openai-chat",
              vendor: "mock",
              model: "mock-chat",
              apiKey: "test-key",
              baseUrl: `http://${ports.host}:${ports.modelPort}`,
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

const seedRealHistorySession = async (
  kernel: AppKernel,
  input: { workspacePath: string; attachmentPath: string },
): Promise<{ sessionId: string; sessionName: string; turns: number }> => {
  const turns = 14;
  const session = await kernel.createSession({
    cwd: input.workspacePath,
    name: "Real history fixture",
  });
  const assetBytes = new Uint8Array(await readFile(input.attachmentPath));
  const [attachment] = await kernel.uploadSessionAssets(session.id, [
    {
      name: "notes.txt",
      mimeType: "text/plain",
      bytes: assetBytes,
    },
  ]);

  for (let turn = 1; turn <= turns; turn += 1) {
    const result = await kernel.sendChat(
      session.id,
      `History prompt ${turn}: confirm the long persisted conversation turn ${turn}.`,
      turn === 1 && attachment ? [attachment.assetId] : [],
    );
    if (!result.ok) {
      throw new Error(result.reason ?? `failed to seed turn ${turn}`);
    }

    await waitForValue(() => {
      const items = kernel.listChatMessages(session.id, 0, turns * 4);
      return items.length >= turn * 2 ? items : null;
    });
  }

  return {
    sessionId: session.id,
    sessionName: session.name,
    turns,
  };
};

export const startE2EServerHarness = async (host = process.env.PLAYWRIGHT_WEB_HOST ?? DEFAULT_HOST): Promise<E2EServerHarness> => {
  const ports = await allocatePorts(host);
  const fixture = await createWorkspaceFixture(ports);
  const modelServer = await createMockModelServer(ports.host, ports.modelPort);
  const trpc = await startTrpcServer({
    host: ports.host,
    port: ports.trpcPort,
    workspaceCwd: fixture.workspacePath,
    globalSessionRoot: fixture.globalSessionRoot,
    workspacesPath: fixture.workspacesPath,
  });
  const historySession = await seedRealHistorySession(trpc.kernel, {
    workspacePath: fixture.workspacePath,
    attachmentPath: fixture.attachmentPath,
  });
  await writeFile(
    E2E_FIXTURE_PATH,
    JSON.stringify(
      {
        workspacePath: fixture.workspacePath,
        attachmentPath: fixture.attachmentPath,
        mockReply: MOCK_REPLY,
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
    stop: async () => {
      webDev.kill();
      await webDev.exited;
      await trpc.stop();
      await new Promise<void>((resolve, reject) => {
        modelServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await rm(fixture.root, { recursive: true, force: true });
      await rm(E2E_FIXTURE_PATH, { force: true });
    },
  };
};
