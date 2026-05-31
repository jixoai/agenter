import type {
  AppAvatarMemoryPackEnsureOutput,
  AppEnsureBindingResult,
  AppRuntimeStore,
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  RuntimeStore,
  SessionEntry,
} from "@agenter/client-sdk";

import { SHELL_APP_ID, SHELL_DEFAULT_AVATAR, createShellAppRuntimeClient } from "./app";
import { readShellManagedState, type ShellManagedState } from "./managed";
import {
  SHELL_ASSISTANT_DISPLAY_NAME,
  buildShellAssistantPromptSeed,
  shellAssistantMemoryRoles,
} from "./shell-assistant-seeds";

export type ShellAutoLoginResult =
  | { ok: true; session: { token: string } }
  | { ok: false; reason: string; message: string };

export interface ShellStore extends AppRuntimeStore {
  autoLogin(): Promise<ShellAutoLoginResult>;
  getAuthSession(): Promise<AuthSessionOutput | null>;
  setAuthToken(token: string | null | undefined): void;
  getAuthToken?(): string | null;
  queryAttention: AppRuntimeStore["queryAttention"];
  commitAttention: AppRuntimeStore["commitAttention"];
  settleAttention: AppRuntimeStore["settleAttention"];
}

export type ShellInteractiveHostStore = ShellStore &
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

export type ShellAppHostStore = ShellInteractiveHostStore;

export interface ShellBootstrapInput {
  store: ShellStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  onProgress?: (phase: ShellBootstrapProgressPhase) => void;
}

export type ShellBootstrapProgressPhase = "authenticating" | "terminal-ready" | "room-ready";

export interface ShellBindingProjection {
  appId: typeof SHELL_APP_ID;
  resourceKey: string;
  terminalId: string;
  roomId: string;
  runtimeSessionId: string;
  runtimeId: string;
  avatarActorId: string;
  hostingContextId: string;
}

export interface ShellBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  terminal: AppEnsureBindingResult<GlobalTerminalEntry>;
  room: AppEnsureBindingResult<GlobalRoomEntry>;
  binding: ShellBindingProjection;
  promptSeeded: boolean;
  memoryFiles: AppAvatarMemoryPackEnsureOutput;
  managed: ShellManagedState;
}

export type ShellRoomBootstrapInput = ShellBootstrapInput;
export type ShellRoomBootstrapResult = ShellBootstrapResult;

const requireSessionAvatarPrincipalId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

const requireAvatarPrincipalId = (
  avatar: GlobalAvatarCatalogEntry,
): NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]> => {
  if (!avatar.avatarPrincipalId) {
    throw new Error(`avatar missing principal id: ${avatar.nickname}`);
  }
  return avatar.avatarPrincipalId;
};

const toRoomActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalRoomActorId => avatarPrincipalId as GlobalRoomActorId;

const requireAutoLogin = async (store: ShellStore): Promise<void> => {
  if (store.getAuthToken?.()) {
    return;
  }
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`shell auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};

const resolveSelectedAvatar = async (
  store: ShellStore,
  avatarNickname: string,
  createAvatar: boolean,
): Promise<{ avatar: GlobalAvatarCatalogEntry; created: boolean }> => {
  const runtimeClient = createShellAppRuntimeClient(store);
  const catalog = await store.hydrateGlobalAvatarCatalog({ force: true });
  const existing = catalog.find((entry) => entry.nickname === avatarNickname);
  if (existing) {
    return { avatar: existing, created: false };
  }
  if (avatarNickname !== SHELL_DEFAULT_AVATAR && !createAvatar) {
    throw new Error(`avatar not found: ${avatarNickname}`);
  }
  const avatar = await runtimeClient.ensureAssistant({
    appId: SHELL_APP_ID,
    avatarNickname,
    displayName: avatarNickname === SHELL_DEFAULT_AVATAR ? SHELL_ASSISTANT_DISPLAY_NAME : avatarNickname,
    classify: avatarNickname === SHELL_DEFAULT_AVATAR ? "assistant" : undefined,
  });
  return { avatar, created: true };
};

const resolveShellAvatarRuntime = async (input: {
  store: ShellStore;
  workspacePath: string;
  avatarNickname: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
}): Promise<{
  runtimeClient: ReturnType<typeof createShellAppRuntimeClient>;
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
  avatarActorId: string;
  promptSeeded: boolean;
  memoryFiles: AppAvatarMemoryPackEnsureOutput;
}> => {
  const runtimeClient = createShellAppRuntimeClient(input.store);
  const resolvedAvatar = await resolveSelectedAvatar(input.store, input.avatarNickname, input.createAvatar === true);
  const avatar = resolvedAvatar.avatar;
  const clearedRuntimeSessionIds =
    input.clearAvatar === true
      ? (
          await runtimeClient.clearRuntimeSession({
            avatarPrincipalId: requireAvatarPrincipalId(avatar),
          })
        ).clearedSessionIds
      : [];
  // Runtime identity is Avatar-scoped. shell session names select terminal/room resources only.
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: false,
  });
  const avatarActorId = requireSessionAvatarPrincipalId(session);

  let promptSeeded = false;
  let memoryFiles: AppAvatarMemoryPackEnsureOutput = [];
  if (avatar.nickname === SHELL_DEFAULT_AVATAR) {
    const avatarPrincipalId = requireSessionAvatarPrincipalId(session);
    const prompt = await runtimeClient.ensureAvatarPromptSeedIfMissing({
      avatarPrincipalId,
      kind: "agenter",
      seedContent: buildShellAssistantPromptSeed(),
    });
    promptSeeded = prompt.seeded;
    memoryFiles = await runtimeClient.ensureMemoryPackIfMissing({
      avatarPrincipalId,
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

const buildShellBindingProjection = (input: {
  shellName: string;
  session: SessionEntry;
  avatar: GlobalAvatarCatalogEntry;
  avatarActorId: string;
  terminal: AppEnsureBindingResult<GlobalTerminalEntry>;
  room: AppEnsureBindingResult<GlobalRoomEntry>;
  managed: ShellManagedState;
}): ShellBindingProjection => ({
  appId: SHELL_APP_ID,
  resourceKey: input.shellName,
  terminalId: input.terminal.entry.terminalId,
  roomId: input.room.entry.chatId,
  runtimeSessionId: input.session.id,
  runtimeId: input.avatar.runtimeId,
  avatarActorId: input.avatarActorId,
  hostingContextId: input.managed.contextId,
});

export const bootstrapShellRoom = async (input: ShellRoomBootstrapInput): Promise<ShellRoomBootstrapResult> => {
  input.onProgress?.("authenticating");
  await requireAutoLogin(input.store);
  const resolved = await resolveShellAvatarRuntime(input);
  const terminal = await resolved.runtimeClient.ensureTerminalBinding({
    session: resolved.session,
    binding: {
      appId: SHELL_APP_ID,
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
      profile: {
        gitLog: "normal",
      },
      start: true,
    },
  });
  input.onProgress?.("terminal-ready");
  const room = await resolved.runtimeClient.ensureRoomBinding({
    session: resolved.session,
    binding: {
      appId: SHELL_APP_ID,
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

  const managed = await readShellManagedState({
    store: input.store,
    sessionId: resolved.session.id,
    runtimeId: resolved.avatar.runtimeId,
    avatarActorId: resolved.avatarActorId,
    shellName: input.shellName,
  });
  const binding = buildShellBindingProjection({
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

export const bootstrapShell = async (input: ShellBootstrapInput): Promise<ShellBootstrapResult> =>
  await bootstrapShellRoom(input);
