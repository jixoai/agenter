import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createAgenterClient, createRuntimeStore, type RuntimeStore } from "@agenter/client-sdk";
import { resolveWorkspaceAvatarAssetRoot } from "../../app-server/src";
import { REAL_MODEL_PROJECT_ROOT, waitForRealValue } from "../../app-server/test-support/real-kernel-harness";
import {
  canProxyRealModelConfig,
  resolveRealModelConfig,
  startCachedRealModelProxy,
  type CachedModelProxyHandle,
  type RealModelConfig,
} from "../../app-server/test-support/real-model-cache";

import { startTrpcServer, type TrpcServerHandle } from "../../cli/src/trpc-server";
import {
  bootstrapCliShell,
  CLI_SHELL_DEFAULT_AVATAR,
  shellAssistantMemoryRoles,
  type CliShellBootstrapInput,
  type CliShellBootstrapResult,
} from "../src";

type CliShellApprovalRequest = Awaited<ReturnType<RuntimeStore["listGlobalTerminalApprovalRequests"]>>[number];

const DEFAULT_TIMEOUT_MS = 240_000;
const BOOTSTRAP_RETRY_TIMEOUT_MS = 15_000;
const REAL_PROVIDER_ID = "real-cli-shell";
const RETRYABLE_BOOTSTRAP_ERROR = "auth-service principal list failed (502)";

const stripLeadingSlash = (value: string): string => value.replace(/^\/+/u, "");

const findFreePort = async (): Promise<number> =>
  await new Promise<number>((resolveReady, rejectReady) => {
    const server = createServer();
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => {
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

const writeProviderSettings = (input: { homeDir: string; config: RealModelConfig }): void => {
  const settingsPath = join(input.homeDir, ".agenter", "settings.json");
  mkdirSync(join(input.homeDir, ".agenter"), { recursive: true });
  writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        ai: {
          activeProvider: REAL_PROVIDER_ID,
          temperature: 0,
          providers: {
            [REAL_PROVIDER_ID]: {
              apiStandard: input.config.apiStandard,
              vendor: input.config.vendor,
              ...(input.config.profile ? { profile: input.config.profile } : {}),
              model: input.config.model,
              baseUrl: input.config.baseUrl,
              apiKey: input.config.apiKey,
              ...(input.config.headers ? { headers: input.config.headers } : {}),
              maxRetries: 0,
            },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
};

const createAuthedStore = async (input: {
  host: string;
  port: number;
}): Promise<{
  client: ReturnType<typeof createAgenterClient>;
  store: RuntimeStore;
}> => {
  const client = createAgenterClient({
    wsUrl: `ws://${input.host}:${input.port}/trpc`,
  });
  const autoLogin = await client.trpc.auth.autoLogin.mutate();
  if (!autoLogin.ok) {
    client.close();
    throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  client.setAuthToken(autoLogin.session.token);
  return {
    client,
    store: createRuntimeStore(client),
  };
};

export interface RealCliShellFixture {
  rootDir: string;
  homeDir: string;
  workspacePath: string;
  handle: TrpcServerHandle;
  proxy: CachedModelProxyHandle | null;
  config: RealModelConfig;
  attached: CliShellBootstrapResult;
  store: RuntimeStore;
  roomChatId: string;
  roomAccessToken?: string;
  assistantActorId: string;
  writeWorkspaceFile: (relativePath: string, content: string) => string;
  listChatMessages: () => Array<{
    messageId: string;
    chatId: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
  sendUserChatMessage: (content: string) => Promise<{ messageId: string; createdAt: number; content: string }>;
  listRoomMessages: () => Array<{
    messageId: number;
    senderActorId?: string;
    from: string;
    content: string;
    createdAt: number;
    recalledAt?: number;
  }>;
  sendUserRoomMessage: (content: string) => Promise<{ messageId: number; createdAt: number; content: string }>;
  countAssistantRoomMessages: () => number;
  waitForAssistantRoomMessage: (input: {
    afterCount: number;
    label: string;
    timeoutMs?: number;
  }) => Promise<{ messageId: number; content: string; senderActorId?: string; from: string; createdAt: number }>;
  readShellTruthTerminal: (input?: {
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
    recordActivity?: boolean;
  }) => Promise<Awaited<ReturnType<RuntimeStore["readGlobalTerminal"]>>>;
  readVisibleTerminal: (input?: {
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
    recordActivity?: boolean;
  }) => Promise<Awaited<ReturnType<RuntimeStore["readGlobalTerminal"]>>>;
  createVisibleTerminalApprovalRequest: (input: {
    text: string;
    mode?: "raw" | "mixed";
  }) => Promise<CliShellApprovalRequest>;
  approveVisibleTerminalApprovalRequest: (input: {
    requestId: string;
    durationMs?: number;
  }) => Promise<Awaited<ReturnType<RuntimeStore["approveGlobalTerminalRequest"]>>>;
  listVisibleTerminalApprovalRequests: (input?: {
    statuses?: CliShellApprovalRequest["status"][];
  }) => Promise<CliShellApprovalRequest[]>;
  denyVisibleTerminalApprovalRequest: (requestId: string) => Promise<unknown>;
  expireVisibleTerminalApprovalRequest: (requestId: string) => Promise<CliShellApprovalRequest>;
  requestManualCompact: (timeoutMs?: number) => Promise<{ cycleId: number }>;
  reconnect: () => Promise<CliShellBootstrapResult>;
  readMemoryPack: () => Record<string, string>;
  readPromptFile: () => string;
  listRecentModelCalls: () => Promise<
    Awaited<ReturnType<TrpcServerHandle["kernel"]["inspectModelDebug"]>>["recentModelCalls"]
  >;
  stop: () => Promise<void>;
}

export interface RealCliShellFixtureOptions {
  avatarNickname?: string;
  shellName?: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
}

export const resolveRealCliShellModelConfig = (): RealModelConfig | null =>
  resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT);

const isRetryableBootstrapError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(RETRYABLE_BOOTSTRAP_ERROR);

const bootstrapCliShellWithRetry = async (input: CliShellBootstrapInput): Promise<CliShellBootstrapResult> =>
  await waitForRealValue(
    async () => {
      try {
        return await bootstrapCliShell(input);
      } catch (error) {
        if (isRetryableBootstrapError(error)) {
          return null;
        }
        throw error;
      }
    },
    {
      label: "real cli-shell bootstrap",
      timeoutMs: BOOTSTRAP_RETRY_TIMEOUT_MS,
    },
  );

export const createRealCliShellFixture = async (
  options: RealCliShellFixtureOptions = {},
): Promise<RealCliShellFixture | null> => {
  const rawConfig = resolveRealCliShellModelConfig();
  if (!rawConfig) {
    return null;
  }
  const avatarNickname = options.avatarNickname ?? CLI_SHELL_DEFAULT_AVATAR;
  const shellName = options.shellName ?? "shell-1";

  const rootDir = mkdtempSync(join(tmpdir(), "agenter-real-cli-shell-"));
  const homeDir = join(rootDir, "home");
  const workspacePath = join(rootDir, "workspace");
  mkdirSync(workspacePath, { recursive: true });

  let proxy: CachedModelProxyHandle | null = null;
  let config = rawConfig;
  if (canProxyRealModelConfig(rawConfig)) {
    const proxyPort = await findFreePort();
    proxy = await startCachedRealModelProxy({
      host: "127.0.0.1",
      port: proxyPort,
      config: rawConfig,
    });
    config = {
      ...rawConfig,
      apiKey: "local-cache",
      baseUrl: `http://127.0.0.1:${proxyPort}/v1`,
    };
  }
  writeProviderSettings({
    homeDir,
    config,
  });

  const port = await findFreePort();
  const handle = await startTrpcServer({
    host: "127.0.0.1",
    port,
    workspaceCwd: workspacePath,
    globalSessionRoot: join(rootDir, "sessions"),
    homeDir,
  });

  let connection = await createAuthedStore({
    host: handle.host,
    port: handle.port,
  });
  let attached = await bootstrapCliShellWithRetry({
    store: connection.store,
    workspacePath,
    avatarNickname,
    shellName,
    createAvatar: options.createAvatar,
    clearAvatar: options.clearAvatar,
  });
  await handle.kernel.attachSessionPrimaryRoom(attached.session.id, { focus: true });
  await connection.store.connect();
  await connection.store.hydrateSessionArtifacts(attached.session.id, {
    includeChatHistory: false,
    observabilityMode: "heartbeat",
  });

  const readRoomMessages = () =>
    handle.kernel.snapshotGlobalRoom({
      chatId: attached.room.entry.chatId,
      accessToken: attached.room.entry.accessToken,
      limit: 200,
    }).items;

  const resolveAssistantActorId = (): string => attached.avatarActorId;

  const countAssistantRoomMessages = () =>
    readRoomMessages().filter((message) => message.senderActorId === resolveAssistantActorId()).length;

  const resolveVisibleTerminalGuardAccessToken = async (): Promise<string> => {
    const grants = await connection.store.listGlobalTerminalGrants(attached.visibleTerminal.entry.terminalId);
    const grant = grants.find(
      (candidate) => candidate.participantId === resolveAssistantActorId() && candidate.role === "guard",
    );
    if (!grant?.accessToken) {
      throw new Error(`expected visible terminal guard grant for ${resolveAssistantActorId()}`);
    }
    return grant.accessToken;
  };

  return {
    rootDir,
    homeDir,
    workspacePath,
    handle,
    proxy,
    config,
    attached,
    store: connection.store,
    roomChatId: attached.room.entry.chatId,
    roomAccessToken: attached.room.entry.accessToken,
    assistantActorId: resolveAssistantActorId(),
    writeWorkspaceFile: (relativePath, content) => {
      const absolutePath = join(workspacePath, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content, "utf8");
      return absolutePath;
    },
    listChatMessages: () =>
      handle.kernel.listChatMessages(attached.session.id, 0, 200).map((message) => ({
        messageId: message.messageId,
        chatId: message.chatId ?? "",
        role: message.role,
        content: message.content,
        createdAt: message.timestamp,
      })),
    sendUserChatMessage: async (content) => {
      const beforeCount = handle.kernel.listChatMessages(attached.session.id, 0, 200).length;
      await connection.store.sendChat(attached.session.id, content);
      return await waitForRealValue(
        () => {
          const next = handle.kernel.listChatMessages(attached.session.id, 0, 200)[beforeCount];
          return next
            ? {
                messageId: next.messageId,
                createdAt: next.timestamp,
                content: next.content,
              }
            : null;
        },
        {
          label: "real cli-shell user chat message",
          timeoutMs: DEFAULT_TIMEOUT_MS,
        },
      );
    },
    listRoomMessages: () =>
      readRoomMessages().map((message) => ({
        messageId: message.messageId,
        ...(message.senderActorId ? { senderActorId: String(message.senderActorId) } : {}),
        from: message.from,
        content: message.content,
        createdAt: message.createdAt,
        ...(typeof message.recalledAt === "number" ? { recalledAt: message.recalledAt } : {}),
      })),
    sendUserRoomMessage: async (content) => {
      const beforeMessageId = readRoomMessages().reduce((max, message) => Math.max(max, message.messageId), 0);
      const sent = await connection.store.sendGlobalRoomMessage({
        chatId: attached.room.entry.chatId,
        accessToken: attached.room.entry.accessToken,
        text: content,
      });
      if (!sent.ok) {
        throw new Error(sent.reason ?? "failed to send room message");
      }
      return await waitForRealValue(
        () => {
          const next = readRoomMessages().find(
            (message) => message.messageId > beforeMessageId && message.content === content,
          );
          return next
            ? {
                messageId: next.messageId,
                createdAt: next.createdAt,
                content: next.content,
              }
            : null;
        },
        {
          label: "real cli-shell user room message",
          timeoutMs: DEFAULT_TIMEOUT_MS,
        },
      );
    },
    countAssistantRoomMessages,
    waitForAssistantRoomMessage: async (input) =>
      await waitForRealValue(
        () => {
          const assistantMessages = readRoomMessages().filter(
            (message) => message.senderActorId === resolveAssistantActorId(),
          );
          const message = assistantMessages[input.afterCount];
          return message
            ? {
                messageId: message.messageId,
                content: message.content,
                senderActorId: message.senderActorId ?? undefined,
                from: message.from,
                createdAt: message.createdAt,
              }
            : null;
        },
        {
          label: input.label,
          timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
      ),
    readShellTruthTerminal: async (input = {}) =>
      await connection.store.readGlobalTerminal({
        terminalId: attached.shellTruthTerminal.entry.terminalId,
        mode: input.mode ?? "snapshot",
        remark: input.remark ?? false,
        recordActivity: input.recordActivity ?? false,
      }),
    readVisibleTerminal: async (input = {}) =>
      await connection.store.readGlobalTerminal({
        terminalId: attached.visibleTerminal.entry.terminalId,
        mode: input.mode ?? "snapshot",
        remark: input.remark ?? false,
        recordActivity: input.recordActivity ?? false,
      }),
    createVisibleTerminalApprovalRequest: async (input) => {
      const terminalId = attached.visibleTerminal.entry.terminalId;
      const accessToken = await resolveVisibleTerminalGuardAccessToken();
      const result =
        input.mode === "mixed"
          ? await connection.store.inputGlobalTerminal({
              terminalId,
              accessToken,
              text: input.text,
              createApprovalRequest: true,
              returnRead: false,
            })
          : await connection.store.writeGlobalTerminal({
              terminalId,
              accessToken,
              text: input.text,
              createApprovalRequest: true,
              returnRead: false,
            });
      if (result.ok || !("approvalRequest" in result) || !result.approvalRequest) {
        throw new Error(`expected guard approval request, got ${JSON.stringify(result)}`);
      }
      return result.approvalRequest;
    },
    approveVisibleTerminalApprovalRequest: async (input) =>
      await connection.store.approveGlobalTerminalRequest({
        terminalId: attached.visibleTerminal.entry.terminalId,
        requestId: input.requestId,
        durationMs: input.durationMs ?? 60_000,
      }),
    listVisibleTerminalApprovalRequests: async (input = {}) =>
      await connection.store.listGlobalTerminalApprovalRequests({
        terminalId: attached.visibleTerminal.entry.terminalId,
        statuses: input.statuses,
      }),
    denyVisibleTerminalApprovalRequest: async (requestId) =>
      await connection.store.denyGlobalTerminalRequest({
        terminalId: attached.visibleTerminal.entry.terminalId,
        requestId,
      }),
    expireVisibleTerminalApprovalRequest: async (requestId) => {
      const terminalId = attached.visibleTerminal.entry.terminalId;
      await connection.store.stopGlobalTerminal({ terminalId });
      const bootstrapped = await connection.store.bootstrapGlobalTerminal({
        terminalId,
        recoveryIntent: "killed-history",
      });
      if (!bootstrapped.ok) {
        throw new Error(`expected visible terminal bootstrap after expiry, got ${bootstrapped.message}`);
      }
      return await waitForRealValue(
        async () => {
          const requests = await connection.store.listGlobalTerminalApprovalRequests({
            terminalId,
            statuses: ["expired"],
          });
          return requests.find((request) => request.requestId === requestId) ?? null;
        },
        {
          label: "expired visible terminal approval request",
          timeoutMs: DEFAULT_TIMEOUT_MS,
        },
      );
    },
    requestManualCompact: async (timeoutMs) => {
      const lastCycleId =
        handle.kernel
          .listChatCycles(attached.session.id, 40)
          .map((cycle) => cycle.cycleId)
          .filter((cycle): cycle is number => typeof cycle === "number")
          .at(-1) ?? 0;
      await connection.store.requestRuntimeCompact(attached.session.id);
      const cycle = await waitForRealValue(
        () => {
          return (
            handle.kernel
              .listChatCycles(attached.session.id, 40)
              .find(
                (entry) =>
                  entry.kind === "compact" &&
                  entry.compactTrigger === "manual" &&
                  entry.status === "done" &&
                  typeof entry.cycleId === "number" &&
                  entry.cycleId > lastCycleId,
              ) ?? null
          );
        },
        {
          label: "real cli-shell compact cycle",
          timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
      );
      if (typeof cycle.cycleId !== "number") {
        throw new Error("expected compact cycle id");
      }
      return {
        cycleId: cycle.cycleId,
      };
    },
    reconnect: async () => {
      connection.store.disconnect();
      connection.client.close();
      connection = await createAuthedStore({
        host: handle.host,
        port: handle.port,
      });
      attached = await bootstrapCliShellWithRetry({
        store: connection.store,
        workspacePath,
        avatarNickname,
        shellName,
        createAvatar: options.createAvatar,
        clearAvatar: options.clearAvatar,
      });
      await handle.kernel.attachSessionPrimaryRoom(attached.session.id, { focus: true });
      await connection.store.connect();
      await connection.store.hydrateSessionArtifacts(attached.session.id, {
        includeChatHistory: false,
        observabilityMode: "heartbeat",
      });
      return attached;
    },
    readMemoryPack: () => {
      const rootPath = resolveWorkspaceAvatarAssetRoot(workspacePath, CLI_SHELL_DEFAULT_AVATAR, "memory", homeDir);
      return Object.fromEntries(
        shellAssistantMemoryRoles.map((role) => {
          const filePath = join(rootPath, stripLeadingSlash(role.path));
          return [role.role, existsSync(filePath) ? readFileSync(filePath, "utf8") : ""];
        }),
      );
    },
    readPromptFile: () => {
      const promptPath = attached.session.avatarPrincipalId
        ? join(homeDir, ".agenter", "avatars", "by-principal", attached.session.avatarPrincipalId, "AGENTER.mdx")
        : "";
      return existsSync(promptPath) ? readFileSync(promptPath, "utf8") : "";
    },
    listRecentModelCalls: async () => (await handle.kernel.inspectModelDebug(attached.session.id)).recentModelCalls,
    stop: async () => {
      connection.store.disconnect();
      connection.client.close();
      await handle.stop();
      await proxy?.stop();
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
};
