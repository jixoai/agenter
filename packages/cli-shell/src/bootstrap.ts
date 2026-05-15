import type {
  AttentionQueryItem,
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalTerminalEntry,
  GlobalTerminalActorId,
  ProductEnsureBindingResult,
  ProductExtensionRuntimeStore,
  RuntimeStore,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "@agenter/client-sdk";
import type { TerminalBackendKind } from "@agenter/termless-core";

import { readCliShellManagedState, type CliShellManagedState } from "./managed";
import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_PRODUCT_ID, createCliShellProductRuntimeClient } from "./product";
import { SHELL_ASSISTANT_DISPLAY_NAME, buildShellAssistantPromptSeed, shellAssistantMemoryRoles } from "./shell-assistant-seeds";
import type { CliShellTuiStore } from "./tui/types";

export type CliShellAutoLoginResult =
  | { ok: true; session: { token: string } }
  | { ok: false; reason: string; message: string };

export interface CliShellStore extends ProductExtensionRuntimeStore {
  autoLogin(): Promise<
    CliShellAutoLoginResult
  >;
  getAuthSession(): Promise<AuthSessionOutput | null>;
  setAuthToken(token: string | null | undefined): void;
  grantGlobalTerminalWriteLease(input: {
    terminalId: string;
    participantId: GlobalTerminalActorId;
    durationMs: number;
  }): Promise<{ leaseId: string; participantId: GlobalTerminalActorId; expiresAt: number }>;
  revokeGlobalTerminalWriteLease(input: {
    terminalId: string;
    leaseId?: string;
    participantId?: GlobalTerminalActorId;
  }): Promise<{ ok: true; revokedCount: number }>;
}

export type CliShellInteractiveHostStore = CliShellStore &
  Pick<
    RuntimeStore,
    "connect" | "disconnect" | "getState" | "hydrateSessionArtifacts" | "hydrateGlobalTerminals"
  >;

export type CliShellProductHostStore = CliShellInteractiveHostStore & CliShellTuiStore;

export interface CliShellBootstrapInput {
  store: CliShellStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
  backend?: TerminalBackendKind;
  onProgress?: (phase: CliShellBootstrapProgressPhase) => void;
}

export type CliShellBootstrapProgressPhase = "authenticating" | "observation-pending";

export interface CliShellBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  session: SessionEntry;
  avatarActorId: GlobalTerminalActorId;
  shellTruthTerminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  visibleTerminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
  managed: CliShellManagedState;
}

const toShellTruthResourceKey = (shellName: string): string => `${shellName}:terminal-1`;
const toVisibleTerminalResourceKey = (shellName: string): string => `${shellName}:terminal-2`;
const TERMINAL_RUNTIME_KIND_METADATA_KEY = "terminalRuntimeKind" as const;

const requireSessionAvatarPrincipalId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

const toTerminalActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalTerminalActorId => avatarPrincipalId as GlobalTerminalActorId;

const toRoomActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalRoomActorId => avatarPrincipalId as GlobalRoomActorId;

const resolveCliShellCommand = (): string[] => [process.env.SHELL ?? "bash", "-i"];

const requireAutoLogin = async (store: CliShellStore): Promise<void> => {
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`cli-shell auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};

const resolveSelectedAvatar = async (
  store: CliShellStore,
  workspacePath: string,
  avatarNickname: string,
): Promise<GlobalAvatarCatalogEntry> => {
  const runtimeClient = createCliShellProductRuntimeClient(store);
  const catalog = await store.hydrateGlobalAvatarCatalog({ force: true });
  const existing = catalog.find((entry) => entry.nickname === avatarNickname);
  if (existing) {
    return existing;
  }
  if (avatarNickname !== CLI_SHELL_DEFAULT_AVATAR) {
    throw new Error(`avatar not found: ${avatarNickname}`);
  }
  return await runtimeClient.ensureAssistant({
    productId: CLI_SHELL_PRODUCT_ID,
    workspacePath,
    avatarNickname,
    displayName: SHELL_ASSISTANT_DISPLAY_NAME,
    classify: "assistant",
  });
};

export const bootstrapCliShell = async (input: CliShellBootstrapInput): Promise<CliShellBootstrapResult> => {
  input.onProgress?.("authenticating");
  await requireAutoLogin(input.store);
  const runtimeClient = createCliShellProductRuntimeClient(input.store);
  const avatar = await resolveSelectedAvatar(input.store, input.workspacePath, input.avatarNickname);
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: true,
  });
  input.onProgress?.("observation-pending");
  const avatarActorId = toTerminalActorId(requireSessionAvatarPrincipalId(session));

  let promptSeeded = false;
  let memoryFiles: WorkspacePrivateTextAssetEnsureOutput[] = [];
  if (avatar.nickname === CLI_SHELL_DEFAULT_AVATAR) {
    const prompt = await runtimeClient.ensurePromptSeedIfMissing({
      sessionId: session.id,
      kind: "agenter",
      seedContent: buildShellAssistantPromptSeed(),
    });
    promptSeeded = prompt.seeded;
    memoryFiles = await runtimeClient.ensureMemoryPackIfMissing({
      workspacePath: input.workspacePath,
      avatarNickname: avatar.nickname,
      roles: [...shellAssistantMemoryRoles],
    });
  }

  const shellTruthTerminal = await runtimeClient.ensureTerminalBinding({
    session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: toShellTruthResourceKey(input.shellName),
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
    },
    participantId: avatarActorId,
    participantLabel: avatar.displayName ?? avatar.nickname,
    grantRole: "requester",
    focus: true,
    createInput: {
      processKind: "shell",
      backend: input.backend,
      command: resolveCliShellCommand(),
      cwd: input.workspacePath,
      start: true,
    },
  });

  const visibleTerminal = await runtimeClient.ensureTerminalBinding({
    session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: toVisibleTerminalResourceKey(input.shellName),
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
      metadata: {
        [TERMINAL_RUNTIME_KIND_METADATA_KEY]: "composed",
        composedShellTerminalId: shellTruthTerminal.entry.terminalId,
      },
    },
    participantId: avatarActorId,
    participantLabel: avatar.displayName ?? avatar.nickname,
    grantRole: "requester",
    focus: true,
    createInput: {
      backend: input.backend,
    },
  });

  const room = await runtimeClient.ensureRoomBinding({
    session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      resourceKind: "room",
      ownerSystem: "message-system",
      title: input.shellName,
    },
    participantId: toRoomActorId(avatarActorId),
    participantLabel: avatar.displayName ?? avatar.nickname,
    grantRole: "member",
    focus: true,
  });

  const managed = await readCliShellManagedState({
    store: input.store,
    sessionId: session.id,
    runtimeId: avatar.runtimeId,
    avatarActorId,
    shellName: input.shellName,
  });

  return {
    avatar,
    session,
    avatarActorId,
    shellTruthTerminal,
    visibleTerminal,
    room,
    promptSeeded,
    memoryFiles,
    managed,
  };
};
