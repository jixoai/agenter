import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AppKernel, type AppKernelOptions, type SessionMeta } from "../src";
import {
  canProxyRealModelConfig,
  resolveRealModelConfig,
  startCachedRealModelProxy,
  type CachedModelProxyHandle,
  type RealModelConfig,
} from "./real-model-cache";

const DEFAULT_POLL_MS = 250;
export const REAL_MODEL_PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const FULL_WORKSPACE_GRANT = [{ pattern: "/", mode: "rw" }] as const;

const allocatePort = async (): Promise<number> => {
  const server = createNetServer();
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  if (!port) {
    throw new Error("failed to allocate ephemeral port");
  }
  return port;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolveReady) => setTimeout(resolveReady, ms));
};

export const waitForRealValue = async <T>(
  read: () => Promise<T | null> | T | null,
  input: {
    label: string;
    timeoutMs?: number;
    pollMs?: number;
  },
): Promise<T> => {
  const timeoutMs = input.timeoutMs ?? 60_000;
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

export interface RealKernelHarness {
  rootDir: string;
  homeDir: string;
  workspacePath: string;
  kernel: AppKernel;
  config: RealModelConfig;
  proxy: CachedModelProxyHandle | null;
  session: SessionMeta;
  restartKernel: () => Promise<void>;
  stop: () => Promise<void>;
}

export const createRealKernelHarness = async (
  input: {
    sessionName?: string;
    logger?: AppKernelOptions["logger"];
  } = {},
): Promise<RealKernelHarness | null> => {
  const projectRoot = REAL_MODEL_PROJECT_ROOT;
  const config = resolveRealModelConfig(projectRoot);
  if (!config) {
    return null;
  }

  const rootDir = await mkdtemp(join(tmpdir(), "agenter-real-kernel-"));
  const homeDir = join(rootDir, "home");
  const workspacePath = join(rootDir, "workspace");
  await mkdir(homeDir, { recursive: true });
  await mkdir(join(workspacePath, ".agenter"), { recursive: true });

  let proxy: CachedModelProxyHandle | null = null;
  let providerBaseUrl = config.baseUrl;
  let providerApiKey = config.apiKey;

  if (canProxyRealModelConfig(config)) {
    const proxyPort = await allocatePort();
    proxy = await startCachedRealModelProxy({
      host: "127.0.0.1",
      port: proxyPort,
      config,
    });
    providerBaseUrl = `http://127.0.0.1:${proxyPort}/v1`;
    providerApiKey = "local-cache";
  }

  const settings = {
    ai: {
      activeProvider: "real-live",
      providers: {
        "real-live": {
          apiStandard: config.apiStandard,
          vendor: config.vendor,
          profile: config.profile,
          headers: config.headers,
          model: config.model,
          apiKey: providerApiKey,
          baseUrl: providerBaseUrl,
          temperature: 0,
          maxRetries: 1,
          maxToken: 64_000,
          compactThreshold: 0.75,
        },
      },
    },
  };
  await writeFile(join(workspacePath, ".agenter", "settings.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  const kernelOptions: AppKernelOptions = {
    homeDir,
    globalSessionRoot: join(rootDir, "sessions"),
    archiveSessionRoot: join(rootDir, "archive", "sessions"),
    workspacesPath: join(rootDir, "workspaces.yaml"),
    logger: input.logger,
  };
  const kernel = new AppKernel(kernelOptions);

  try {
    await kernel.start();
    const session = await kernel.createSession({
      cwd: workspacePath,
      name: input.sessionName ?? "real-loopbus",
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
      throw new Error(`real harness missing primary room after explicit attach: ${startedSession.id}`);
    }
    if (
      !kernel.listMessageChannels(startedSession.id).some((channel) => channel.chatId === startedSession.primaryRoomId)
    ) {
      throw new Error(`real harness failed to restore attached primary room: ${startedSession.id}`);
    }
    if (
      !kernel
        .listRuntimeWorkspaceMounts(startedSession.id)
        .some((mount) => mount.workspacePath === resolve(workspacePath))
    ) {
      throw new Error(`real harness missing explicit workspace mount: ${startedSession.id}`);
    }
    if (kernel.listTerminals(startedSession.id).length > 0) {
      throw new Error(`real harness booted with unexpected terminals: ${startedSession.id}`);
    }
    const harness: RealKernelHarness = {
      rootDir,
      homeDir,
      workspacePath,
      kernel,
      config,
      proxy,
      session: startedSession,
      restartKernel: async () => {
        await harness.kernel.stop();
        const nextKernel = new AppKernel(kernelOptions);
        await nextKernel.start();
        const restored = nextKernel.getSession(harness.session.id);
        if (!restored) {
          throw new Error(`real harness failed to reload session after kernel restart: ${harness.session.id}`);
        }
        harness.kernel = nextKernel;
        harness.session = restored;
      },
      stop: async () => {
        await harness.kernel.abortSession(harness.session.id).catch(() => {});
        await harness.kernel.stop();
        await proxy?.stop();
        await rm(rootDir, { recursive: true, force: true });
      },
    };
    return harness;
  } catch (error) {
    await kernel.stop().catch(() => {});
    await proxy?.stop().catch(() => {});
    await rm(rootDir, { recursive: true, force: true });
    throw error;
  }
};
