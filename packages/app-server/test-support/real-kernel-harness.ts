import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

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
const DEFAULT_DIAGNOSTIC_MESSAGE_LIMIT = 24;
const DEFAULT_DIAGNOSTIC_PROMPT_WINDOW_LIMIT = 12;

const clipText = (value: string | undefined, maxChars = 1_200): string | undefined => {
  if (value === undefined || value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...<clipped ${value.length - maxChars} chars>`;
};

const readModelOutcomeCode = (outcome: unknown): string | null => {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    return typeof outcome === "string" ? outcome : null;
  }
  return typeof (outcome as { code?: unknown }).code === "string" ? (outcome as { code: string }).code : null;
};

const extractToolTraceTools = (response: unknown): string[] => {
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string"
      ? [entry.tool]
      : [],
  );
};

const projectToolTrace = (
  response: unknown,
): Array<{
  tool: string;
  input?: unknown;
  output?: unknown;
  error?: string | null;
}> => {
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.tool !== "string") {
      return [];
    }
    const output =
      entry.output && typeof entry.output === "object" && !Array.isArray(entry.output)
        ? {
            ...(entry.output as Record<string, unknown>),
            ...(typeof (entry.output as { stdout?: unknown }).stdout === "string"
              ? { stdout: clipText((entry.output as { stdout: string }).stdout) }
              : {}),
            ...(typeof (entry.output as { stderr?: unknown }).stderr === "string"
              ? { stderr: clipText((entry.output as { stderr: string }).stderr) }
              : {}),
          }
        : entry.output;
    return [
      {
        tool: entry.tool,
        ...("input" in entry ? { input: entry.input } : {}),
        ...(output !== undefined ? { output } : {}),
        error: typeof entry.error === "string" ? entry.error : null,
      },
    ];
  });
};

const projectPromptWindowEntry = (message: unknown): Record<string, unknown> => {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { raw: message };
  }
  const role =
    typeof (message as { role?: unknown }).role === "string" ? (message as { role: string }).role : undefined;
  const content =
    typeof (message as { content?: unknown }).content === "string"
      ? clipText((message as { content: string }).content)
      : undefined;
  return {
    ...(role ? { role } : {}),
    ...(content ? { content } : {}),
    ...(role || content ? {} : { raw: message }),
  };
};

const toRoomDiagnosticMessage = (
  record: MessageRecord,
  assistantNickname: string,
): {
  rowId: number;
  messageId: number;
  chatId: string;
  role: "assistant" | "user";
  from: string;
  senderActorId?: string;
  content: string;
  timestamp: number;
  updatedAt: number;
  visibleAt?: number;
  recalledAt?: number;
  recalledByActorId?: string;
} => ({
  rowId: record.rowId,
  messageId: record.messageId,
  chatId: record.chatId,
  role: record.from === assistantNickname ? "assistant" : "user",
  from: record.from,
  senderActorId: record.senderActorId,
  content: clipText(record.content) ?? "",
  timestamp: record.createdAt,
  updatedAt: record.updatedAt,
  visibleAt: record.visibleAt,
  recalledAt: record.recalledAt,
  recalledByActorId: record.recalledByActorId,
});

const getMessageControlPlane = (kernel: AppKernel): MessageControlPlane =>
  Reflect.get(kernel, "messageControlPlane") as MessageControlPlane;

export interface RealKernelHarnessDiagnostics {
  label?: string;
  avatar: {
    nickname: string;
    principalId: string;
    promptPath: string | null;
  };
  session: {
    id: string;
    primaryRoomId: string | null;
  };
  roomTruth: Array<{
    rowId: number;
    messageId: number;
    chatId: string;
    role: "assistant" | "user";
    from: string;
    senderActorId?: string;
    content: string;
    timestamp: number;
    updatedAt: number;
    visibleAt?: number;
    recalledAt?: number;
    recalledByActorId?: string;
  }>;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    createdAt: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    toolTraceTools: string[];
    toolTrace: Array<{
      tool: string;
      input?: unknown;
      output?: unknown;
      error?: string | null;
    }>;
  }>;
  promptWindow: Array<Record<string, unknown>>;
  validationResources: RealKernelHarnessValidationResourcesDiagnostics;
}

export interface RealKernelHarnessOwnedPortRecord {
  kind: string;
  label: string;
  host: string;
  port: number;
  expectedUrl?: string;
  declaredAt: number;
  owner: "validation-run";
}

export interface RealKernelHarnessCleanupReport {
  status: "not_started" | "completed" | "failed";
  startedAt: number | null;
  completedAt: number | null;
  sessionAbort: "pending" | "done" | "failed";
  kernelStop: "pending" | "done" | "failed";
  proxyStop: "skipped" | "pending" | "done" | "failed";
  rootDirRemove: "pending" | "done" | "failed";
  errors: string[];
}

export interface RealKernelHarnessValidationResourcesDiagnostics {
  runId: string;
  ownershipBoundary: string;
  ownedPorts: RealKernelHarnessOwnedPortRecord[];
  cleanup: RealKernelHarnessCleanupReport;
}

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
  avatarNickname: string;
  avatarPromptPath: string | null;
  kernel: AppKernel;
  config: RealModelConfig;
  proxy: CachedModelProxyHandle | null;
  session: SessionMeta;
  collectDiagnostics: (input?: {
    label?: string;
    messageLimit?: number;
    promptWindowLimit?: number;
  }) => Promise<RealKernelHarnessDiagnostics>;
  declareOwnedPort: (input: {
    kind: string;
    label: string;
    port: number;
    expectedUrl?: string;
    host?: string;
  }) => RealKernelHarnessOwnedPortRecord;
  getValidationResources: () => RealKernelHarnessValidationResourcesDiagnostics;
  restartKernel: () => Promise<void>;
  stop: () => Promise<RealKernelHarnessCleanupReport>;
}

export const createRealKernelHarness = async (
  input: {
    sessionName?: string;
    avatarNickname?: string;
    agenterPromptContent?: string;
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
  const avatarNickname = input.avatarNickname ?? "default";
  const agenterPromptContent = input.agenterPromptContent?.trim();
  await mkdir(homeDir, { recursive: true });
  await mkdir(join(workspacePath, ".agenter"), { recursive: true });
  const avatarPromptPath = agenterPromptContent
    ? join(homeDir, ".agenter", "avatars", "by-nickname", avatarNickname, "AGENTER.mdx")
    : null;
  if (avatarPromptPath && agenterPromptContent) {
    await mkdir(join(homeDir, ".agenter", "avatars", "by-nickname", avatarNickname), { recursive: true });
    await writeFile(avatarPromptPath, agenterPromptContent, "utf8");
  }

  let proxy: CachedModelProxyHandle | null = null;
  let proxyPort: number | null = null;
  let providerBaseUrl = config.baseUrl;
  let providerApiKey = config.apiKey;

  if (canProxyRealModelConfig(config)) {
    proxyPort = await allocatePort();
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
      avatar: avatarNickname,
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
    const ownedPorts: RealKernelHarnessOwnedPortRecord[] = [];
    const cleanup: RealKernelHarnessCleanupReport = {
      status: "not_started",
      startedAt: null,
      completedAt: null,
      sessionAbort: "pending",
      kernelStop: "pending",
      proxyStop: proxy ? "pending" : "skipped",
      rootDirRemove: "pending",
      errors: [],
    };
    const snapshotCleanup = (): RealKernelHarnessCleanupReport => ({
      ...cleanup,
      errors: cleanup.errors.slice(),
    });
    const snapshotValidationResources = (): RealKernelHarnessValidationResourcesDiagnostics => ({
      runId: startedSession.id,
      ownershipBoundary:
        "Only resources listed here are owned by this validation run. Any other listener, terminal, or background task should be treated as external to this run.",
      ownedPorts: ownedPorts.map((record) => ({ ...record })),
      cleanup: snapshotCleanup(),
    });
    const pushCleanupError = (step: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      cleanup.errors.push(`${step}: ${message}`);
    };
    const declareOwnedPort = (resourceInput: {
      kind: string;
      label: string;
      port: number;
      expectedUrl?: string;
      host?: string;
    }): RealKernelHarnessOwnedPortRecord => {
      const existingIndex = ownedPorts.findIndex(
        (record) =>
          record.kind === resourceInput.kind &&
          record.port === resourceInput.port &&
          record.expectedUrl === resourceInput.expectedUrl,
      );
      const nextRecord: RealKernelHarnessOwnedPortRecord = {
        kind: resourceInput.kind,
        label: resourceInput.label,
        host: resourceInput.host ?? "127.0.0.1",
        port: resourceInput.port,
        expectedUrl: resourceInput.expectedUrl,
        declaredAt: Date.now(),
        owner: "validation-run",
      };
      if (existingIndex >= 0) {
        ownedPorts[existingIndex] = nextRecord;
      } else {
        ownedPorts.push(nextRecord);
      }
      return nextRecord;
    };
    if (proxyPort !== null) {
      declareOwnedPort({
        kind: "model-proxy",
        label: "real model cache proxy",
        port: proxyPort,
        expectedUrl: `http://127.0.0.1:${proxyPort}/v1`,
      });
    }
    const harness: RealKernelHarness = {
      rootDir,
      homeDir,
      workspacePath,
      avatarNickname,
      avatarPromptPath,
      kernel,
      config,
      proxy,
      session: startedSession,
      collectDiagnostics: async (diagnosticInput = {}) => {
        const debug = await harness.kernel.inspectModelDebug(harness.session.id);
        const channels = harness.kernel.listMessageChannels(harness.session.id);
        const roomTruth = channels
          .flatMap((channel) =>
            getMessageControlPlane(harness.kernel)
              .snapshot(channel.chatId, diagnosticInput.messageLimit ?? DEFAULT_DIAGNOSTIC_MESSAGE_LIMIT)
              .items.map((item) => toRoomDiagnosticMessage(item, harness.session.avatar)),
          )
          .sort((left, right) => left.timestamp - right.timestamp);
        return {
          ...(diagnosticInput.label ? { label: diagnosticInput.label } : {}),
          avatar: {
            nickname: harness.session.avatar,
            principalId: harness.session.avatarPrincipalId ?? "",
            promptPath: harness.avatarPromptPath,
          },
          session: {
            id: harness.session.id,
            primaryRoomId: harness.session.primaryRoomId ?? null,
          },
          roomTruth,
          recentModelCalls: debug.recentModelCalls.map((call) => ({
            id: call.id,
            cycleId: call.cycleId,
            createdAt: call.createdAt,
            status: call.status,
            outcome: readModelOutcomeCode(call.outcome),
            toolTraceTools: extractToolTraceTools(call.response),
            toolTrace: projectToolTrace(call.response),
          })),
          promptWindow: debug.promptWindow
            .slice(-(diagnosticInput.promptWindowLimit ?? DEFAULT_DIAGNOSTIC_PROMPT_WINDOW_LIMIT))
            .map(projectPromptWindowEntry),
          validationResources: snapshotValidationResources(),
        };
      },
      declareOwnedPort,
      getValidationResources: snapshotValidationResources,
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
        cleanup.startedAt ??= Date.now();
        cleanup.status = "failed";
        try {
          await harness.kernel.abortSession(harness.session.id);
          cleanup.sessionAbort = "done";
        } catch (error) {
          cleanup.sessionAbort = "failed";
          pushCleanupError("abortSession", error);
        }
        try {
          await harness.kernel.stop();
          cleanup.kernelStop = "done";
        } catch (error) {
          cleanup.kernelStop = "failed";
          pushCleanupError("kernel.stop", error);
        }
        if (proxy) {
          try {
            await proxy.stop();
            cleanup.proxyStop = "done";
          } catch (error) {
            cleanup.proxyStop = "failed";
            pushCleanupError("proxy.stop", error);
          }
        }
        try {
          await rm(rootDir, { recursive: true, force: true });
          cleanup.rootDirRemove = "done";
        } catch (error) {
          cleanup.rootDirRemove = "failed";
          pushCleanupError("rm(rootDir)", error);
        }
        cleanup.completedAt = Date.now();
        cleanup.status = cleanup.errors.length === 0 ? "completed" : "failed";
        return snapshotCleanup();
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
