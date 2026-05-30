import type {
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  ProductEnsureBindingResult,
  ProductExtensionRuntimeStore,
  RuntimeStore,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "@agenter/client-sdk";

import { readCliShellManagedState, type CliShellManagedState } from "./managed";
import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_PRODUCT_ID, createCliShellProductRuntimeClient } from "./product";
import {
  SHELL_ASSISTANT_DISPLAY_NAME,
  buildShellAssistantPromptSeed,
  shellAssistantMemoryRoles,
} from "./shell-assistant-seeds";

export type CliShellAutoLoginResult =
  | { ok: true; session: { token: string } }
  | { ok: false; reason: string; message: string };

export interface CliShellStore extends ProductExtensionRuntimeStore {
  autoLogin(): Promise<CliShellAutoLoginResult>;
  getAuthSession(): Promise<AuthSessionOutput | null>;
  setAuthToken(token: string | null | undefined): void;
  getAuthToken?(): string | null;
  queryAttention: ProductExtensionRuntimeStore["queryAttention"];
  commitAttention: ProductExtensionRuntimeStore["commitAttention"];
  settleAttention: ProductExtensionRuntimeStore["settleAttention"];
}

export type CliShellInteractiveHostStore = CliShellStore &
  Pick<
    RuntimeStore,
    | "connect"
    | "disconnect"
    | "getState"
    | "retainGlobalRoomSnapshot"
    | "hydrateGlobalRoomSnapshot"
    | "sendGlobalRoomMessage"
    | "readSettings"
    | "retainTerminalPermissionRequests"
    | "hydrateGlobalTerminalApprovals"
    | "approveGlobalTerminalRequest"
    | "denyGlobalTerminalRequest"
  >;

export type CliShellProductHostStore = CliShellInteractiveHostStore;

export interface CliShellBootstrapInput {
  store: CliShellStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  onProgress?: (phase: CliShellBootstrapProgressPhase) => void;
}

export type CliShellBootstrapProgressPhase = "authenticating" | "terminal-ready" | "room-ready";

export interface CliShellBindingProjection {
  productId: typeof CLI_SHELL_PRODUCT_ID;
  resourceKey: string;
  terminalId: string;
  roomId: string;
  runtimeSessionId: string;
  runtimeId: string;
  avatarActorId: string;
  hostingContextId: string;
}

export interface CliShellBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  terminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  binding: CliShellBindingProjection;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
  managed: CliShellManagedState;
}

export type CliShellRoomBootstrapInput = CliShellBootstrapInput;
export type CliShellRoomBootstrapResult = CliShellBootstrapResult;

const requireSessionAvatarPrincipalId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

const toRoomActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalRoomActorId => avatarPrincipalId as GlobalRoomActorId;

const requireAutoLogin = async (store: CliShellStore): Promise<void> => {
  if (store.getAuthToken?.()) {
    return;
  }
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
  createAvatar: boolean,
): Promise<{ avatar: GlobalAvatarCatalogEntry; created: boolean }> => {
  const runtimeClient = createCliShellProductRuntimeClient(store);
  const catalog = await store.hydrateGlobalAvatarCatalog({ force: true });
  const existing = catalog.find((entry) => entry.nickname === avatarNickname);
  if (existing) {
    return { avatar: existing, created: false };
  }
  if (avatarNickname !== CLI_SHELL_DEFAULT_AVATAR && !createAvatar) {
    throw new Error(`avatar not found: ${avatarNickname}`);
  }
  const avatar = await runtimeClient.ensureAssistant({
    productId: CLI_SHELL_PRODUCT_ID,
    workspacePath,
    avatarNickname,
    displayName: avatarNickname === CLI_SHELL_DEFAULT_AVATAR ? SHELL_ASSISTANT_DISPLAY_NAME : avatarNickname,
    classify: avatarNickname === CLI_SHELL_DEFAULT_AVATAR ? "assistant" : undefined,
  });
  return { avatar, created: true };
};

const resolveCliShellAvatarRuntime = async (input: {
  store: CliShellStore;
  workspacePath: string;
  avatarNickname: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
}): Promise<{
  runtimeClient: ReturnType<typeof createCliShellProductRuntimeClient>;
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
}> => {
  const runtimeClient = createCliShellProductRuntimeClient(input.store);
  const resolvedAvatar = await resolveSelectedAvatar(
    input.store,
    input.workspacePath,
    input.avatarNickname,
    input.createAvatar === true,
  );
  const avatar = resolvedAvatar.avatar;
  const clearedRuntimeSessionIds =
    input.clearAvatar === true
      ? (
          await runtimeClient.clearRuntimeSession({
            workspacePath: input.workspacePath,
            avatarNickname: avatar.nickname,
          })
        ).clearedSessionIds
      : [];
  // Runtime identity is Avatar-scoped. cli-shell session names select tmux/room resources only.
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: false,
  });
  const avatarActorId = requireSessionAvatarPrincipalId(session);

  let promptSeeded = false;
  let memoryFiles: WorkspacePrivateTextAssetEnsureOutput[] = [];
  if (avatar.nickname === CLI_SHELL_DEFAULT_AVATAR) {
    const prompt = await runtimeClient.ensureAvatarPromptSeedIfMissing({
      avatarPrincipalId: requireSessionAvatarPrincipalId(session),
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
  await runtimeClient.startRuntime(session.id);

  return {
    runtimeClient,
    avatar,
    avatarCreated: resolvedAvatar.created,
    session,
    clearedRuntimeSessionIds,
    avatarActorId,
    promptSeeded,
    memoryFiles,
  };
};

const buildCliShellBindingProjection = (input: {
  shellName: string;
  session: SessionEntry;
  avatar: GlobalAvatarCatalogEntry;
  avatarActorId: string;
  terminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  managed: CliShellManagedState;
}): CliShellBindingProjection => ({
  productId: CLI_SHELL_PRODUCT_ID,
  resourceKey: input.shellName,
  terminalId: input.terminal.entry.terminalId,
  roomId: input.room.entry.chatId,
  runtimeSessionId: input.session.id,
  runtimeId: input.avatar.runtimeId,
  avatarActorId: input.avatarActorId,
  hostingContextId: input.managed.contextId,
});

export const bootstrapCliShellRoom = async (
  input: CliShellRoomBootstrapInput,
): Promise<CliShellRoomBootstrapResult> => {
  input.onProgress?.("authenticating");
  await requireAutoLogin(input.store);
  const resolved = await resolveCliShellAvatarRuntime(input);
  const terminal = await resolved.runtimeClient.ensureTerminalBinding({
    session: resolved.session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
    },
    participantId: resolved.avatarActorId as GlobalTerminalActorId,
    participantLabel: resolved.avatar.displayName ?? resolved.avatar.nickname,
    focus: true,
    createInput: {
      processKind: "shell",
      backend: "ghostty-native",
      cwd: input.workspacePath,
      start: true,
    },
  });
  input.onProgress?.("terminal-ready");
  const room = await resolved.runtimeClient.ensureRoomBinding({
    session: resolved.session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      resourceKind: "room",
      ownerSystem: "message-system",
      title: input.shellName,
    },
    participantId: toRoomActorId(resolved.avatarActorId as NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>),
    participantLabel: resolved.avatar.displayName ?? resolved.avatar.nickname,
    grantRole: "member",
    focus: true,
  });
  input.onProgress?.("room-ready");

  const managed = await readCliShellManagedState({
    store: input.store,
    sessionId: resolved.session.id,
    runtimeId: resolved.avatar.runtimeId,
    avatarActorId: resolved.avatarActorId,
    shellName: input.shellName,
  });
  const binding = buildCliShellBindingProjection({
    shellName: input.shellName,
    session: resolved.session,
    avatar: resolved.avatar,
    avatarActorId: resolved.avatarActorId,
    terminal,
    room,
    managed,
  });

  return {
    avatar: resolved.avatar,
    avatarCreated: resolved.avatarCreated,
    session: resolved.session,
    clearedRuntimeSessionIds: resolved.clearedRuntimeSessionIds,
    avatarActorId: resolved.avatarActorId,
    terminal,
    room,
    binding,
    promptSeeded: resolved.promptSeeded,
    memoryFiles: resolved.memoryFiles,
    managed,
  };
};

export const bootstrapCliShell = async (input: CliShellBootstrapInput): Promise<CliShellBootstrapResult> =>
  await bootstrapCliShellRoom(input);
