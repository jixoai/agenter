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
import type { TerminalBackendKind } from "@agenter/termless-core";

import { readCliShellManagedState, type CliShellManagedState } from "./managed";
import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_PRODUCT_ID, createCliShellProductRuntimeClient } from "./product";
import {
  SHELL_ASSISTANT_DISPLAY_NAME,
  buildShellAssistantPromptSeed,
  shellAssistantMemoryRoles,
} from "./shell-assistant-seeds";
import type { CliShellTuiStore } from "./tui/types";

export type CliShellAutoLoginResult =
  | { ok: true; session: { token: string } }
  | { ok: false; reason: string; message: string };

export interface CliShellStore extends ProductExtensionRuntimeStore {
  autoLogin(): Promise<CliShellAutoLoginResult>;
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
  Pick<RuntimeStore, "connect" | "disconnect" | "getState" | "hydrateSessionArtifacts" | "hydrateGlobalTerminals">;

export type CliShellProductHostStore = CliShellInteractiveHostStore & CliShellTuiStore;

export interface CliShellBootstrapInput {
  store: CliShellStore;
  workspacePath: string;
  avatarNickname: string;
  shellName: string;
  createAvatar?: boolean;
  clearAvatar?: boolean;
  backend?: TerminalBackendKind;
  onProgress?: (phase: CliShellBootstrapProgressPhase) => void;
}

export type CliShellBootstrapProgressPhase = "authenticating" | "observation-pending";

export interface CliShellBootstrapResult {
  avatar: GlobalAvatarCatalogEntry;
  avatarCreated: boolean;
  session: SessionEntry;
  clearedRuntimeSessionIds: string[];
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

const revokeParticipantTerminalGrants = async (
  store: CliShellStore,
  terminalId: string,
  participantId: GlobalTerminalActorId,
): Promise<void> => {
  const grants = await store.listGlobalTerminalGrants(terminalId);
  for (const grant of grants) {
    if (grant.participantId === participantId) {
      await store.revokeGlobalTerminalGrant({
        terminalId,
        grantId: grant.grantId,
      });
    }
  }
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
  if (avatarNickname !== CLI_SHELL_DEFAULT_AVATAR) {
    if (createAvatar) {
      const avatar = await runtimeClient.ensureAssistant({
        productId: CLI_SHELL_PRODUCT_ID,
        workspacePath,
        avatarNickname,
        displayName: avatarNickname,
      });
      return { avatar, created: true };
    }
    throw new Error(`avatar not found: ${avatarNickname}`);
  }
  const avatar = await runtimeClient.ensureAssistant({
    productId: CLI_SHELL_PRODUCT_ID,
    workspacePath,
    avatarNickname,
    displayName: SHELL_ASSISTANT_DISPLAY_NAME,
    classify: "assistant",
  });
  return { avatar, created: true };
};

export const bootstrapCliShell = async (input: CliShellBootstrapInput): Promise<CliShellBootstrapResult> => {
  input.onProgress?.("authenticating");
  await requireAutoLogin(input.store);
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
  // This is intentionally a runtime reset only; cli-shell resource cleanup remains a separate product command.
  const session = await runtimeClient.ensureRuntime({
    workspacePath: input.workspacePath,
    avatarNickname: avatar.nickname,
    autoStart: false,
  });
  const avatarActorId = toTerminalActorId(requireSessionAvatarPrincipalId(session));

  let promptSeeded = false;
  let memoryFiles: WorkspacePrivateTextAssetEnsureOutput[] = [];
  if (avatar.nickname === CLI_SHELL_DEFAULT_AVATAR) {
    const prompt = await runtimeClient.ensureAvatarPromptSeedIfMissing({
      avatarPrincipalId: requireSessionAvatarPrincipalId(session),
      workspacePath: input.workspacePath,
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
  input.onProgress?.("observation-pending");

  const shellTruthTerminal = await runtimeClient.ensureTerminalBinding({
    session,
    binding: {
      productId: CLI_SHELL_PRODUCT_ID,
      resourceKey: toShellTruthResourceKey(input.shellName),
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
    },
    // terminal-1 is product plumbing for the composed terminal. Do not grant the Avatar direct access
    // to it, or runtime terminal tools will expose the internal shell as an alternative action target.
    focus: false,
    createInput: {
      processKind: "shell",
      backend: input.backend,
      command: resolveCliShellCommand(),
      cwd: input.workspacePath,
      start: true,
    },
  });
  await revokeParticipantTerminalGrants(input.store, shellTruthTerminal.entry.terminalId, avatarActorId);

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
    grantRole: "guard",
    focus: false,
    createInput: {
      backend: input.backend,
    },
  });
  await runtimeClient.focusRuntimeTerminals({
    sessionId: session.id,
    op: "replace",
    terminalIds: [visibleTerminal.entry.terminalId],
  });
  const focusedVisibleTerminal: ProductEnsureBindingResult<GlobalTerminalEntry> = {
    ...visibleTerminal,
    focused: true,
  };

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
    avatarCreated: resolvedAvatar.created,
    session,
    clearedRuntimeSessionIds,
    avatarActorId,
    shellTruthTerminal,
    visibleTerminal: focusedVisibleTerminal,
    room,
    promptSeeded,
    memoryFiles,
    managed,
  };
};
