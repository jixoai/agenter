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

import { readShellNextManagedState, type ShellNextManagedState } from "./managed";
import { SHELL_NEXT_DEFAULT_AVATAR, SHELL_NEXT_PRODUCT_ID, createShellNextProductRuntimeClient } from "./product";
import {
  SHELL_ASSISTANT_DISPLAY_NAME,
  buildShellAssistantPromptSeed,
  shellAssistantMemoryRoles,
} from "./shell-assistant-seeds";

export type ShellNextAutoLoginResult =
  | { ok: true; session: { token: string } }
  | { ok: false; reason: string; message: string };

export interface ShellNextStore extends ProductExtensionRuntimeStore {
  autoLogin(): Promise<ShellNextAutoLoginResult>;
  getAuthSession(): Promise<AuthSessionOutput | null>;
  setAuthToken(token: string | null | undefined): void;
  getAuthToken?(): string | null;
  queryAttention: ProductExtensionRuntimeStore["queryAttention"];
  commitAttention: ProductExtensionRuntimeStore["commitAttention"];
  settleAttention: ProductExtensionRuntimeStore["settleAttention"];
}

export type ShellNextInteractiveHostStore = ShellNextStore &
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

export type ShellNextProductHostStore = ShellNextInteractiveHostStore;

export interface ShellNextBootstrapInput {
  store: ShellNextStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  onProgress?: (phase: ShellNextBootstrapProgressPhase) => void;
}

export type ShellNextBootstrapProgressPhase = "authenticating" | "terminal-ready" | "room-ready";

export interface ShellNextBindingProjection {
  productId: typeof SHELL_NEXT_PRODUCT_ID;
  resourceKey: string;
  terminalId: string;
  roomId: string;
  runtimeSessionId: string;
  runtimeId: string;
  avatarActorId: string;
  hostingContextId: string;
}

export interface ShellNextBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  terminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  binding: ShellNextBindingProjection;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
  managed: ShellNextManagedState;
}

export type ShellNextRoomBootstrapInput = ShellNextBootstrapInput;
export type ShellNextRoomBootstrapResult = ShellNextBootstrapResult;

const requireSessionAvatarPrincipalId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

const toRoomActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalRoomActorId => avatarPrincipalId as GlobalRoomActorId;

const requireAutoLogin = async (store: ShellNextStore): Promise<void> => {
  if (store.getAuthToken?.()) {
    return;
  }
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`shell-next auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};

const resolveSelectedAvatar = async (
  store: ShellNextStore,
  workspacePath: string,
  avatarNickname: string,
  createAvatar: boolean,
): Promise<{ avatar: GlobalAvatarCatalogEntry; created: boolean }> => {
  const runtimeClient = createShellNextProductRuntimeClient(store);
  const catalog = await store.hydrateGlobalAvatarCatalog({ force: true });
  const existing = catalog.find((entry) => entry.nickname === avatarNickname);
  if (existing) {
    return { avatar: existing, created: false };
  }
  if (avatarNickname !== SHELL_NEXT_DEFAULT_AVATAR && !createAvatar) {
    throw new Error(`avatar not found: ${avatarNickname}`);
  }
  const avatar = await runtimeClient.ensureAssistant({
    productId: SHELL_NEXT_PRODUCT_ID,
    workspacePath,
    avatarNickname,
    displayName: avatarNickname === SHELL_NEXT_DEFAULT_AVATAR ? SHELL_ASSISTANT_DISPLAY_NAME : avatarNickname,
    classify: avatarNickname === SHELL_NEXT_DEFAULT_AVATAR ? "assistant" : undefined,
  });
  return { avatar, created: true };
};

const resolveShellNextAvatarRuntime = async (input: {
  store: ShellNextStore;
  workspacePath: string;
  avatarNickname: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
}): Promise<{
  runtimeClient: ReturnType<typeof createShellNextProductRuntimeClient>;
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
}> => {
  const runtimeClient = createShellNextProductRuntimeClient(input.store);
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
  // Runtime identity is Avatar-scoped. shell-next session names select terminal/room resources only.
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: false,
  });
  const avatarActorId = requireSessionAvatarPrincipalId(session);

  let promptSeeded = false;
  let memoryFiles: WorkspacePrivateTextAssetEnsureOutput[] = [];
  if (avatar.nickname === SHELL_NEXT_DEFAULT_AVATAR) {
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

const buildShellNextBindingProjection = (input: {
  shellName: string;
  session: SessionEntry;
  avatar: GlobalAvatarCatalogEntry;
  avatarActorId: string;
  terminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  managed: ShellNextManagedState;
}): ShellNextBindingProjection => ({
  productId: SHELL_NEXT_PRODUCT_ID,
  resourceKey: input.shellName,
  terminalId: input.terminal.entry.terminalId,
  roomId: input.room.entry.chatId,
  runtimeSessionId: input.session.id,
  runtimeId: input.avatar.runtimeId,
  avatarActorId: input.avatarActorId,
  hostingContextId: input.managed.contextId,
});

export const bootstrapShellNextRoom = async (
  input: ShellNextRoomBootstrapInput,
): Promise<ShellNextRoomBootstrapResult> => {
  input.onProgress?.("authenticating");
  await requireAutoLogin(input.store);
  const resolved = await resolveShellNextAvatarRuntime(input);
  const terminal = await resolved.runtimeClient.ensureTerminalBinding({
    session: resolved.session,
    binding: {
      productId: SHELL_NEXT_PRODUCT_ID,
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
      productId: SHELL_NEXT_PRODUCT_ID,
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

  const managed = await readShellNextManagedState({
    store: input.store,
    sessionId: resolved.session.id,
    runtimeId: resolved.avatar.runtimeId,
    avatarActorId: resolved.avatarActorId,
    shellName: input.shellName,
  });
  const binding = buildShellNextBindingProjection({
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

export const bootstrapShellNext = async (input: ShellNextBootstrapInput): Promise<ShellNextBootstrapResult> =>
  await bootstrapShellNextRoom(input);
