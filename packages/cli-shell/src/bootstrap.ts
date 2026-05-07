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
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "@agenter/client-sdk";

import { readCliShellManagedState, type CliShellManagedState } from "./managed";
import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_PRODUCT_ID, createCliShellProductRuntimeClient } from "./product";
import { SHELL_ASSISTANT_DISPLAY_NAME, buildShellAssistantPromptSeed, shellAssistantMemoryRoles } from "./shell-assistant-seeds";

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

export interface CliShellBootstrapInput {
  store: CliShellStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
}

export interface CliShellBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  session: SessionEntry;
  terminal: ProductEnsureBindingResult<GlobalTerminalEntry>;
  room: ProductEnsureBindingResult<GlobalRoomEntry>;
  promptSeeded: boolean;
  memoryFiles: WorkspacePrivateTextAssetEnsureOutput[];
  managed: CliShellManagedState;
}

const requireAvatarPrincipalId = (avatar: GlobalAvatarCatalogEntry): NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]> => {
  if (!avatar.avatarPrincipalId) {
    throw new Error(`avatar missing principal id: ${avatar.nickname}`);
  }
  return avatar.avatarPrincipalId;
};

const toTerminalActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalTerminalActorId => avatarPrincipalId as GlobalTerminalActorId;

const toRoomActorId = (
  avatarPrincipalId: NonNullable<GlobalAvatarCatalogEntry["avatarPrincipalId"]>,
): GlobalRoomActorId => avatarPrincipalId as GlobalRoomActorId;

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
  await requireAutoLogin(input.store);
  const runtimeClient = createCliShellProductRuntimeClient(input.store);
  const avatar = await resolveSelectedAvatar(input.store, input.workspacePath, input.avatarNickname);
  const avatarPrincipalId = requireAvatarPrincipalId(avatar);
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: true,
  });

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

  const terminal = await runtimeClient.ensureTerminalBinding({
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
    },
    participantId: toTerminalActorId(avatarPrincipalId),
    participantLabel: avatar.displayName ?? avatar.nickname,
    grantRole: "requester",
    focus: true,
    createInput: {
      processKind: "shell",
      cwd: input.workspacePath,
      start: true,
    },
  });

  const room = await runtimeClient.ensureRoomBinding({
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: input.shellName,
      resourceKind: "room",
      ownerSystem: "message-system",
      title: input.shellName,
    },
    participantId: toRoomActorId(avatarPrincipalId),
    participantLabel: avatar.displayName ?? avatar.nickname,
    grantRole: "member",
    focus: true,
  });

  const managed = await readCliShellManagedState({
    store: input.store,
    sessionId: session.id,
    runtimeId: avatar.runtimeId,
    avatarActorId: avatarPrincipalId,
    shellName: input.shellName,
  });

  return {
    avatar,
    session,
    terminal,
    room,
    promptSeeded,
    memoryFiles,
    managed,
  };
};
