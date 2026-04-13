import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, type AppKernelOptions, type SessionMeta } from "../src";
import { startMockModelServer, type MockModelServerHandle } from "./mock-model-server";

const DEFAULT_POLL_MS = 50;
const FULL_WORKSPACE_GRANT = [{ pattern: "/", mode: "rw" }] as const;

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolveReady) => setTimeout(resolveReady, ms));
};

export const waitForMockValue = async <T>(
  read: () => Promise<T | null> | T | null,
  input: {
    label: string;
    timeoutMs?: number;
    pollMs?: number;
  },
): Promise<T> => {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const pollMs = input.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) {
      return value;
    }
    await sleep(pollMs);
  }
  throw new Error(`timed out waiting for ${input.label}`);
};

export interface MockKernelHarness {
  rootDir: string;
  workspacePath: string;
  kernel: AppKernel;
  mockServer: MockModelServerHandle;
  session: SessionMeta;
  stop: () => Promise<void>;
}

export const createMockKernelHarness = async (
  input: {
    sessionName?: string;
    logger?: AppKernelOptions["logger"];
  } = {},
): Promise<MockKernelHarness> => {
  const rootDir = await mkdtemp(join(tmpdir(), "agenter-mock-kernel-"));
  const workspacePath = join(rootDir, "workspace");
  await mkdir(join(workspacePath, ".agenter"), { recursive: true });

  const mockServer = await startMockModelServer();
  const settings = {
    avatar: "relay-bot",
    ai: {
      activeProvider: "mock-live",
      providers: {
        "mock-live": {
          apiStandard: "openai-chat",
          vendor: "mock",
          profile: "compatible",
          model: "mock-loopbus",
          apiKey: "local-test",
          baseUrl: mockServer.baseUrl,
          temperature: 0,
          maxRetries: 0,
          maxToken: 64_000,
          compactThreshold: 0.75,
        },
      },
    },
    features: {
      message: {
        chatMainDefaults: {
          title: "kzf",
          participants: [
            { id: "session:relay-bot", label: "relay-bot" },
            { id: "auth:kzf", label: "kzf" },
          ],
        },
      },
    },
  };
  await writeFile(
    join(workspacePath, ".agenter", "settings.local.json"),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );

  const kernel = new AppKernel({
    globalSessionRoot: join(rootDir, "sessions"),
    archiveSessionRoot: join(rootDir, "archive", "sessions"),
    workspacesPath: join(rootDir, "workspaces.yaml"),
    logger: input.logger,
  });

  try {
    await kernel.start();
    const session = await kernel.createSession({
      cwd: workspacePath,
      name: input.sessionName ?? "mock-loopbus",
      autoStart: false,
    });
    await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath,
      grants: [...FULL_WORKSPACE_GRANT],
    });
    const startedSession = await kernel.startSession(session.id);
    if (!startedSession.primaryRoomId) {
      throw new Error(`mock harness missing primary room after explicit attach: ${startedSession.id}`);
    }
    if (
      !kernel.listMessageChannels(startedSession.id).some((channel) => channel.chatId === startedSession.primaryRoomId)
    ) {
      throw new Error(`mock harness failed to restore attached primary room: ${startedSession.id}`);
    }
    return {
      rootDir,
      workspacePath,
      kernel,
      mockServer,
      session: startedSession,
      stop: async () => {
        await kernel.abortSession(startedSession.id).catch(() => {});
        await kernel.stop().catch(() => {});
        await mockServer.stop().catch(() => {});
        await rm(rootDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await kernel.stop().catch(() => {});
    await mockServer.stop().catch(() => {});
    await rm(rootDir, { recursive: true, force: true });
    throw error;
  }
};
