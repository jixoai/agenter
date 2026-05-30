import {
  buildAppBindingMetadata,
  matchesAppBindingMetadata,
  type AppAssistantEnsureInput,
  type AppAttentionCommitInput,
  type AppAttentionQueryInput,
  type AppAttentionSettleInput,
  type AppAvatarPromptSeedInput,
  type AppBindingMetadata,
  type AppMemoryPackEnsureInput,
  type AppResourceBindingInput,
  type AppRuntimeSessionClearInput,
} from "@agenter/app-runtime";

import type {
  AttentionQueryItem,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "./types";

export interface AppTerminalComposedSurfaceState {
  shellTerminalId: string;
  terminalId: string;
  cols: number;
  rows: number;
  seq?: number;
  lines: string[];
  richLines?: Array<{
    spans: Array<{
      text: string;
      fg?: string;
      bg?: string;
      bold?: boolean;
      underline?: boolean;
      inverse?: boolean;
    }>;
  }>;
  selectionSources?: Array<{
    owner: string;
    row: number;
    col: number;
    width: number;
    height: number;
    sourceStartRow?: number;
  }>;
  cursor: { x: number; y: number; visible?: boolean };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AppRuntimeStore {
  listSessions(): Promise<SessionEntry[]>;
  createSession(input: { cwd: string; name?: string; avatar?: string; autoStart?: boolean }): Promise<SessionEntry>;
  startSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  hydrateGlobalAvatarCatalog(input?: { force?: boolean }): Promise<GlobalAvatarCatalogEntry[]>;
  createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry>;
  readSettings(
    sessionId: string,
    kind: "settings" | "agenter",
  ): Promise<{ path: string; content: string; mtimeMs: number }>;
  saveSettings(input: {
    sessionId: string;
    kind: "settings" | "agenter";
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  >;
  ensureAvatarPromptSeed(input: AppAvatarPromptSeedInput): Promise<{
    seeded: boolean;
    file: { path: string; content: string; mtimeMs: number };
  }>;
  listGlobalTerminals(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalArchive(): Promise<GlobalTerminalEntry[]>;
  createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }>;
  deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }>;
  archiveGlobalTerminal(input: { terminalId: string }): Promise<GlobalTerminalEntry>;
  bootstrapGlobalTerminal(input: {
    terminalId: string;
    recoveryIntent?: "killed-history";
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }>;
  setGlobalTerminalConfig(input: {
    terminalId: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    launchCwd?: string;
    env?: Record<string, string>;
    cols?: number;
    rows?: number;
    gitLog?: false | "none" | "normal" | "verbose";
    logStyle?: "plain" | "rich";
    title?: string;
    icon?: string;
    shortcuts?: Record<string, string>;
    rendererPreference?: "auto" | "ghostty-web" | "wterm" | "xterm";
    theme?: "default-dark" | "default-light" | "monokai";
    cursor?: "block" | "bar" | "underline";
    font?: {
      family: string;
      sizePx: number;
      lineHeight: number;
      letterSpacing: number;
      weight: string;
      weightBold: string;
      ligatures: boolean;
    };
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
  publishGlobalTerminalComposedSurface(input: {
    terminalId: string;
    surface: AppTerminalComposedSurfaceState;
  }): Promise<unknown>;
  listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]>;
  issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "guard" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown>;
  revokeGlobalTerminalGrant(input: { terminalId: string; grantId: string }): Promise<{ ok: boolean }>;
  focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  listGlobalRooms(input?: { includeArchived?: boolean }): Promise<GlobalRoomEntry[]>;
  createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
    initialUsers?: Array<{
      contactId: GlobalRoomActorId;
      label?: string;
      role: "admin" | "member" | "readonly";
      focused?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<GlobalRoomEntry>;
  listGlobalRoomGrants(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomGrantEntry[]>;
  issueGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: GlobalRoomActorId;
    label?: string;
    accessTokenHint?: string;
  }): Promise<unknown>;
  focusMessageChannels(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<unknown>;
  focusGlobalRooms(input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }>;
  archiveGlobalRoom(input: { chatId: string; accessToken?: string; archivedBy?: string }): Promise<GlobalRoomEntry>;
  deleteGlobalRoom(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomEntry>;
  ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput>;
  queryAttention(input: {
    sessionId: string;
    query: string;
    offset?: number;
    limit?: number;
  }): Promise<AttentionQueryItem[]>;
  commitAttention(input: { sessionId: string } & AppAttentionCommitInput): Promise<{ commit: unknown }>;
  settleAttention(input: { sessionId: string } & AppAttentionSettleInput): Promise<{ commit: unknown }>;
}

export interface AppEnsureRuntimeInput {
  workspacePath: string;
  avatarNickname: string;
  sessionName?: string;
  autoStart?: boolean;
}

export interface AppRuntimeSessionClearResult {
  clearedSessionIds: string[];
}

export interface AppRuntimeTerminalFocusInput {
  sessionId: string;
  op: "add" | "remove" | "replace" | "clear";
  terminalIds: string[];
}

export interface AppRuntimeTerminalFocusResult {
  ok: boolean;
  message: string;
  focusedTerminalIds: string[];
}

export interface AppEnsureBindingResult<TEntry> {
  entry: TEntry;
  created: boolean;
  granted: boolean;
  focused: boolean;
  bindingMetadata: AppBindingMetadata;
}

const requireSessionActorId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

export interface AppEnsureTerminalBindingInput {
  session: SessionEntry;
  binding: AppResourceBindingInput & {
    resourceKind: "terminal";
    ownerSystem: "terminal-system";
  };
  terminalId?: string;
  participantId?: GlobalTerminalActorId;
  participantLabel?: string;
  grantRole?: "admin" | "writer" | "guard" | "readonly";
  focus?: boolean;
  createInput?: {
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    start?: boolean;
  };
}

export interface AppEnsureRoomBindingInput {
  session: SessionEntry;
  binding: AppResourceBindingInput & {
    resourceKind: "room";
    ownerSystem: "message-system";
  };
  participantId?: GlobalRoomActorId;
  participantLabel?: string;
  grantRole?: "admin" | "member" | "readonly";
  focus?: boolean;
}

const isAvatarClassify = (
  value: string | null | undefined,
): value is NonNullable<GlobalAvatarCatalogEntry["classify"]> =>
  value === "assistant" ||
  value === "backend" ||
  value === "frontend" ||
  value === "design" ||
  value === "ops" ||
  value === "reviewer";

const mergeBindingMetadata = (
  binding: AppResourceBindingInput,
): { bindingMetadata: AppBindingMetadata; metadata: Record<string, unknown> } => {
  const bindingMetadata = buildAppBindingMetadata(binding);
  return {
    bindingMetadata,
    metadata: {
      ...(binding.metadata ?? {}),
      ...bindingMetadata,
    },
  };
};

const equalStringRecord = (
  left: Record<string, string> | undefined,
  right: Record<string, string> | undefined,
): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
};

const equalStringArray = (left: readonly string[] | undefined, right: readonly string[] | undefined): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
};

const needsMetadataPatch = (current: Record<string, unknown> | undefined, desired: Record<string, unknown>): boolean =>
  Object.entries(desired).some(([key, value]) => current?.[key] !== value);

const isProjectionTerminalBinding = (metadata: Record<string, unknown> | undefined): boolean =>
  typeof metadata?.projectionSourceTerminalId === "string" && metadata.projectionSourceTerminalId.length > 0;

const isComposedTerminalBinding = (metadata: Record<string, unknown> | undefined): boolean =>
  metadata?.terminalRuntimeKind === "composed" &&
  typeof metadata?.composedShellTerminalId === "string" &&
  metadata.composedShellTerminalId.length > 0;

const isDerivedTerminalBinding = (metadata: Record<string, unknown> | undefined): boolean =>
  isProjectionTerminalBinding(metadata) || isComposedTerminalBinding(metadata);

const isExplicitTerminalBinding = (
  metadata: Record<string, unknown> | undefined,
  bindingMetadata: AppBindingMetadata,
): boolean => matchesAppBindingMetadata(metadata, bindingMetadata) || isDerivedTerminalBinding(metadata);

const buildTerminalReusePatch = (
  entry: GlobalTerminalEntry,
  input: AppEnsureTerminalBindingInput,
  metadata: Record<string, unknown>,
): Parameters<AppRuntimeStore["setGlobalTerminalConfig"]>[0] | null => {
  const patch: Parameters<AppRuntimeStore["setGlobalTerminalConfig"]>[0] = {
    terminalId: entry.terminalId,
  };
  let changed = false;

  if (input.createInput?.processKind && input.createInput.processKind !== entry.processKind) {
    patch.processKind = input.createInput.processKind;
    changed = true;
  }
  if (input.createInput?.backend && input.createInput.backend !== entry.backend) {
    patch.backend = input.createInput.backend;
    changed = true;
  }
  if (input.createInput?.command && !equalStringArray(input.createInput.command, entry.command)) {
    patch.command = [...input.createInput.command];
    changed = true;
  }
  if (input.createInput?.cwd && input.createInput.cwd !== entry.launchCwd) {
    patch.launchCwd = input.createInput.cwd;
    changed = true;
  }

  const profile = input.createInput?.profile;
  if (profile?.command) {
    patch.command = [...profile.command];
    changed = true;
  }
  if (profile?.cwd) {
    patch.launchCwd = profile.cwd;
    changed = true;
  }
  if (profile?.cols !== undefined && profile.cols !== entry.snapshot?.cols) {
    patch.cols = profile.cols;
    changed = true;
  }
  if (profile?.rows !== undefined && profile.rows !== entry.snapshot?.rows) {
    patch.rows = profile.rows;
    changed = true;
  }
  if (profile?.gitLog !== undefined) {
    patch.gitLog = profile.gitLog;
    changed = true;
  }
  if (profile?.logStyle !== undefined) {
    patch.logStyle = profile.logStyle;
    changed = true;
  }
  if (profile?.icon !== undefined && profile.icon !== entry.icon) {
    patch.icon = profile.icon;
    changed = true;
  }
  if (profile?.title !== undefined && profile.title !== entry.configuredTitle) {
    patch.title = profile.title;
    changed = true;
  }
  if (profile?.shortcuts !== undefined && !equalStringRecord(profile.shortcuts, entry.shortcuts)) {
    patch.shortcuts = profile.shortcuts;
    changed = true;
  }
  if (needsMetadataPatch(entry.metadata, metadata)) {
    patch.metadata = metadata;
    changed = true;
  }

  return changed ? patch : null;
};

export class AppRuntimeClient {
  constructor(private readonly store: AppRuntimeStore) {}

  async ensureRuntime(input: AppEnsureRuntimeInput): Promise<SessionEntry> {
    return await this.store.createSession({
      cwd: input.workspacePath,
      name: input.sessionName,
      avatar: input.avatarNickname,
      autoStart: input.autoStart ?? true,
    });
  }

  async startRuntime(sessionId: string): Promise<void> {
    await this.store.startSession(sessionId);
  }

  async clearRuntimeSession(input: AppRuntimeSessionClearInput): Promise<AppRuntimeSessionClearResult> {
    const sessions = await this.store.listSessions();
    // AvatarRuntime identity is Avatar-scoped; app shell labels must not become hidden runtime axes.
    // Workspace scope is still part of the runtime session selection to avoid clearing another workspace's live context.
    const matches = sessions.filter(
      (session) => session.workspacePath === input.workspacePath && session.avatar === input.avatarNickname,
    );
    for (const session of matches) {
      await this.store.deleteSession(session.id);
    }
    return {
      clearedSessionIds: matches.map((session) => session.id),
    };
  }

  async focusRuntimeTerminals(input: AppRuntimeTerminalFocusInput): Promise<AppRuntimeTerminalFocusResult> {
    return await this.store.focusTerminals(input);
  }

  async ensureAssistant(input: AppAssistantEnsureInput): Promise<GlobalAvatarCatalogEntry> {
    const catalog = await this.store.hydrateGlobalAvatarCatalog({ force: true });
    const existing = catalog.find((entry) => entry.nickname === input.avatarNickname);
    if (existing) {
      return existing;
    }
    return await this.store.createGlobalAvatar({
      nickname: input.avatarNickname,
      displayName: input.displayName ?? null,
      classify: isAvatarClassify(input.classify) ? input.classify : null,
    });
  }

  async ensureAvatarPromptSeedIfMissing(
    input: AppAvatarPromptSeedInput,
  ): Promise<{ seeded: boolean; file: { path: string; content: string; mtimeMs: number } }> {
    return await this.store.ensureAvatarPromptSeed(input);
  }

  async ensureMemoryPackIfMissing(
    input: AppMemoryPackEnsureInput,
  ): Promise<WorkspacePrivateTextAssetEnsureOutput[]> {
    const results: WorkspacePrivateTextAssetEnsureOutput[] = [];
    for (const role of input.roles) {
      results.push(
        await this.store.ensureWorkspacePrivateTextAsset({
          workspacePath: input.workspacePath,
          avatarNickname: input.avatarNickname,
          assetKind: "memory",
          relativePath: role.path,
          seedContent: role.seedContent,
        }),
      );
    }
    return results;
  }

  async ensureTerminalBinding(
    input: AppEnsureTerminalBindingInput,
  ): Promise<AppEnsureBindingResult<GlobalTerminalEntry>> {
    const { bindingMetadata, metadata } = mergeBindingMetadata(input.binding);
    const sessionActorId = requireSessionActorId(input.session);
    // App resource keys are app-owned binding names, not TerminalSystem ids.
    // Reusing the key as a terminal id makes killed/history rows collide with new live bindings.
    const terminalId = input.terminalId;
    const shouldStart = input.createInput?.start ?? false;
    const terminals = await this.store.listGlobalTerminals();
    let entry =
      terminals.find((candidate) => matchesAppBindingMetadata(candidate.metadata, bindingMetadata)) ??
      (terminalId
        ? terminals.find(
            (candidate) =>
              candidate.terminalId === terminalId || isExplicitTerminalBinding(candidate.metadata, bindingMetadata),
          )
        : undefined);
    let created = false;
    const requestedBackend = input.createInput?.backend;
    if (!entry) {
      const result = await this.store.createGlobalTerminal({
        terminalId,
        processKind: input.createInput?.processKind,
        backend: requestedBackend,
        command: input.createInput?.command,
        cwd: input.createInput?.cwd,
        profile: input.createInput?.profile,
        metadata,
        start: input.createInput?.start,
        focus: input.focus ?? true,
      });
      if (!result.terminal) {
        throw new Error(result.message);
      }
      entry = result.terminal;
      created = true;
    }
    if (!created) {
      if (
        requestedBackend &&
        entry.processPhase === "running" &&
        entry.backend !== requestedBackend &&
        !isDerivedTerminalBinding(entry.metadata)
      ) {
        throw new Error(
          `terminal backend mismatch: ${entry.terminalId} is running with ${entry.backend}, requested ${requestedBackend}`,
        );
      }
      const entryId = entry.terminalId;
      const patch = buildTerminalReusePatch(entry, input, metadata);
      if (patch) {
        await this.store.setGlobalTerminalConfig(patch);
        const refreshed = await this.store.listGlobalTerminals();
        entry =
          refreshed.find((candidate) => candidate.terminalId === entryId) ??
          refreshed.find((candidate) => matchesAppBindingMetadata(candidate.metadata, bindingMetadata)) ??
          entry;
      }
    }
    if (!created && shouldStart && entry.processPhase !== "running") {
      const bootstrapped = await this.store.bootstrapGlobalTerminal({
        terminalId: entry.terminalId,
      });
      if (!bootstrapped.terminal) {
        throw new Error(bootstrapped.message);
      }
      entry = bootstrapped.terminal;
    }

    let granted = false;
    let focusedAccessToken: string | undefined;
    if (input.participantId) {
      const grants = await this.store.listGlobalTerminalGrants(entry.terminalId);
      const existingGrant = grants.find(
        (grant) => grant.participantId === input.participantId && grant.role === (input.grantRole ?? "writer"),
      );
      if (!existingGrant) {
        const issued = await this.store.issueGlobalTerminalGrant({
          terminalId: entry.terminalId,
          role: input.grantRole ?? "writer",
          participantId: input.participantId,
          label: input.participantLabel,
        });
        focusedAccessToken = (issued as { accessToken?: string }).accessToken;
        granted = true;
      } else {
        focusedAccessToken = existingGrant.accessToken;
      }
    }

    const focused = input.focus ?? true;
    if (focused) {
      if (!input.participantId || input.participantId === sessionActorId) {
        await this.store.focusTerminals({
          sessionId: input.session.id,
          op: "add",
          terminalIds: [entry.terminalId],
        });
      } else if (focusedAccessToken) {
        await this.store.focusGlobalTerminals({
          op: "add",
          terminalIds: [entry.terminalId],
          accessToken: focusedAccessToken,
        });
      } else {
        await this.store.focusGlobalTerminals({
          op: "add",
          terminalIds: [entry.terminalId],
        });
      }
    }

    return {
      entry,
      created,
      granted,
      focused,
      bindingMetadata,
    };
  }

  async ensureRoomBinding(input: AppEnsureRoomBindingInput): Promise<AppEnsureBindingResult<GlobalRoomEntry>> {
    const { bindingMetadata, metadata } = mergeBindingMetadata(input.binding);
    const sessionActorId = requireSessionActorId(input.session);
    const rooms = await this.store.listGlobalRooms();
    let entry = rooms.find((candidate) => matchesAppBindingMetadata(candidate.metadata, bindingMetadata));
    let created = false;
    if (!entry) {
      entry = await this.store.createGlobalRoom({
        title: input.binding.title ?? input.binding.resourceKey,
        metadata,
        focus: input.focus ?? true,
      });
      created = true;
    }

    let granted = false;
    let focusedAccessToken: string | undefined;
    if (input.participantId) {
      const grants = await this.store.listGlobalRoomGrants({
        chatId: entry.chatId,
      });
      const existingGrant = grants.find(
        (grant) => grant.participantId === input.participantId && grant.role === (input.grantRole ?? "member"),
      );
      if (!existingGrant) {
        const issued = await this.store.issueGlobalRoomGrant({
          chatId: entry.chatId,
          role: input.grantRole ?? "member",
          participantId: input.participantId,
          label: input.participantLabel,
        });
        focusedAccessToken = (issued as { accessToken?: string }).accessToken;
        granted = true;
      } else {
        focusedAccessToken = existingGrant.accessToken;
      }
    }

    const focused = input.focus ?? true;
    if (focused) {
      if (!input.participantId || input.participantId === sessionActorId) {
        const accessToken =
          focusedAccessToken ?? (entry.accessToken && entry.accessRole !== "readonly" ? entry.accessToken : undefined);
        if (accessToken) {
          await this.store.focusMessageChannels({
            sessionId: input.session.id,
            op: "add",
            channels: [{ chatId: entry.chatId, accessToken }],
          });
        }
      } else if (focusedAccessToken) {
        await this.store.focusMessageChannels({
          sessionId: input.session.id,
          op: "add",
          channels: [{ chatId: entry.chatId, accessToken: focusedAccessToken }],
        });
        await this.store.focusGlobalRooms({
          op: "add",
          channels: [{ chatId: entry.chatId, accessToken: focusedAccessToken }],
        });
      } else {
        await this.store.focusGlobalRooms({
          op: "add",
          channels: [{ chatId: entry.chatId }],
        });
      }
    }

    return {
      entry,
      created,
      granted,
      focused,
      bindingMetadata,
    };
  }

  async archiveRoom(input: { chatId: string; accessToken?: string; archivedBy?: string }): Promise<GlobalRoomEntry> {
    return await this.store.archiveGlobalRoom(input);
  }

  async queryAttention(input: { sessionId: string } & AppAttentionQueryInput): Promise<AttentionQueryItem[]> {
    return await this.store.queryAttention(input);
  }

  async commitAttention(input: { sessionId: string } & AppAttentionCommitInput): Promise<{ commit: unknown }> {
    return await this.store.commitAttention(input);
  }

  async settleAttention(input: { sessionId: string } & AppAttentionSettleInput): Promise<{ commit: unknown }> {
    return await this.store.settleAttention(input);
  }
}

export const createAppRuntimeClient = (
  store: AppRuntimeStore,
): AppRuntimeClient => new AppRuntimeClient(store);
