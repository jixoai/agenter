import {
  buildProductBindingMetadata,
  matchesProductBindingMetadata,
  type ProductAssistantEnsureInput,
  type ProductAttentionCommitInput,
  type ProductAttentionQueryInput,
  type ProductAttentionSettleInput,
  type ProductBindingMetadata,
  type ProductDelegationCreateInput,
  type ProductDelegationLookup,
  type ProductMemoryPackEnsureInput,
  type ProductPromptSeedInput,
  type ProductResourceBindingInput,
} from "@agenter/product-extension-runtime";

import type {
  AttentionQueryItem,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  ProductDelegationRecord,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "./types";

export interface ProductTerminalComposedSurfaceState {
  shellTerminalId: string;
  terminalId: string;
  shellSnapshotSeq: number;
  cols: number;
  rows: number;
  bottomLine: string;
  dialogueOpen: boolean;
  dialoguePlacement: "left" | "right" | "floating" | null;
  dialogueDraft: string;
  managedLabel: string;
  unreadLabel: string;
  heartbeatLabel: string;
  terminalLines: string[];
  terminalRichLines?: Array<{
    spans: Array<{
      text: string;
      fg?: string;
      bg?: string;
      bold?: boolean;
      underline?: boolean;
      inverse?: boolean;
    }>;
  }>;
  cursor: { x: number; y: number; visible?: boolean };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
}

export interface ProductExtensionRuntimeStore {
  createSession(input: { cwd: string; name?: string; avatar?: string; autoStart?: boolean }): Promise<SessionEntry>;
  hydrateGlobalAvatarCatalog(input?: { force?: boolean }): Promise<GlobalAvatarCatalogEntry[]>;
  createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry>;
  readSettings(
    sessionId: string,
    kind: "settings" | "agenter" | "system" | "template" | "contract",
  ): Promise<{ path: string; content: string; mtimeMs: number }>;
  saveSettings(input: {
    sessionId: string;
    kind: "settings" | "agenter" | "system" | "template" | "contract";
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  >;
  listGlobalTerminals(): Promise<GlobalTerminalEntry[]>;
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
  bootstrapGlobalTerminal(input: {
    terminalId: string;
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
    surface: ProductTerminalComposedSurfaceState;
  }): Promise<unknown>;
  listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]>;
  issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown>;
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
      actorId: GlobalRoomActorId;
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
  ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput>;
  queryAttention(input: { sessionId: string; query: string; offset?: number; limit?: number }): Promise<AttentionQueryItem[]>;
  commitAttention(input: { sessionId: string } & ProductAttentionCommitInput): Promise<{ commit: unknown }>;
  settleAttention(input: { sessionId: string } & ProductAttentionSettleInput): Promise<{ commit: unknown }>;
  listProductDelegations(input: ProductDelegationLookup): Promise<ProductDelegationRecord[]>;
  createProductDelegation(input: ProductDelegationCreateInput): Promise<ProductDelegationRecord>;
  revokeProductDelegation(input: {
    delegationId: string;
    revokedAt: number;
    revokedReason: string;
  }): Promise<ProductDelegationRecord>;
}

export interface ProductEnsureRuntimeInput {
  workspacePath: string;
  avatarNickname: string;
  sessionName?: string;
  autoStart?: boolean;
}

export interface ProductEnsureBindingResult<TEntry> {
  entry: TEntry;
  created: boolean;
  granted: boolean;
  focused: boolean;
  bindingMetadata: ProductBindingMetadata;
}

const requireSessionActorId = (session: SessionEntry): NonNullable<SessionEntry["avatarPrincipalId"]> => {
  if (!session.avatarPrincipalId) {
    throw new Error(`session missing avatar principal id: ${session.id}`);
  }
  return session.avatarPrincipalId;
};

export interface ProductEnsureTerminalBindingInput {
  session: SessionEntry;
  binding: ProductResourceBindingInput & {
    resourceKind: "terminal";
    ownerSystem: "terminal-system";
  };
  terminalId?: string;
  participantId?: GlobalTerminalActorId;
  participantLabel?: string;
  grantRole?: "admin" | "writer" | "requester" | "readonly";
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

export interface ProductEnsureRoomBindingInput {
  session: SessionEntry;
  binding: ProductResourceBindingInput & {
    resourceKind: "room";
    ownerSystem: "message-system";
  };
  participantId?: GlobalRoomActorId;
  participantLabel?: string;
  grantRole?: "admin" | "member" | "readonly";
  focus?: boolean;
}

const hasDurableContent = (file: { mtimeMs: number }): boolean => file.mtimeMs > 0;

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
  binding: ProductResourceBindingInput,
): { bindingMetadata: ProductBindingMetadata; metadata: Record<string, unknown> } => {
  const bindingMetadata = buildProductBindingMetadata(binding);
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

const buildTerminalReusePatch = (
  entry: GlobalTerminalEntry,
  input: ProductEnsureTerminalBindingInput,
  metadata: Record<string, unknown>,
): Parameters<ProductExtensionRuntimeStore["setGlobalTerminalConfig"]>[0] | null => {
  const patch: Parameters<ProductExtensionRuntimeStore["setGlobalTerminalConfig"]>[0] = {
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

export class ProductExtensionRuntimeClient {
  constructor(private readonly store: ProductExtensionRuntimeStore) {}

  async ensureRuntime(input: ProductEnsureRuntimeInput): Promise<SessionEntry> {
    return await this.store.createSession({
      cwd: input.workspacePath,
      name: input.sessionName,
      avatar: input.avatarNickname,
      autoStart: input.autoStart ?? true,
    });
  }

  async ensureAssistant(input: ProductAssistantEnsureInput): Promise<GlobalAvatarCatalogEntry> {
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

  async ensurePromptSeedIfMissing(
    input: ProductPromptSeedInput,
  ): Promise<{ seeded: boolean; file: { path: string; content: string; mtimeMs: number } }> {
    const current = await this.store.readSettings(input.sessionId, input.kind);
    if (hasDurableContent(current)) {
      return {
        seeded: false,
        file: current,
      };
    }
    const saved = await this.store.saveSettings({
      sessionId: input.sessionId,
      kind: input.kind,
      content: input.seedContent,
      baseMtimeMs: current.mtimeMs,
    });
    if (!saved.ok) {
      return {
        seeded: false,
        file: saved.latest,
      };
    }
    return {
      seeded: true,
      file: saved.file,
    };
  }

  async ensureMemoryPackIfMissing(input: ProductMemoryPackEnsureInput): Promise<WorkspacePrivateTextAssetEnsureOutput[]> {
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

  async ensureTerminalBinding(input: ProductEnsureTerminalBindingInput): Promise<ProductEnsureBindingResult<GlobalTerminalEntry>> {
    const { bindingMetadata, metadata } = mergeBindingMetadata(input.binding);
    const sessionActorId = requireSessionActorId(input.session);
    const terminalId = input.terminalId ?? input.binding.resourceKey;
    const shouldStart = input.createInput?.start ?? false;
    const terminals = await this.store.listGlobalTerminals();
    let entry =
      terminals.find((candidate) => matchesProductBindingMetadata(candidate.metadata, bindingMetadata)) ??
      terminals.find((candidate) => candidate.terminalId === terminalId);
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
          refreshed.find((candidate) => matchesProductBindingMetadata(candidate.metadata, bindingMetadata)) ??
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

  async ensureRoomBinding(input: ProductEnsureRoomBindingInput): Promise<ProductEnsureBindingResult<GlobalRoomEntry>> {
    const { bindingMetadata, metadata } = mergeBindingMetadata(input.binding);
    const sessionActorId = requireSessionActorId(input.session);
    const rooms = await this.store.listGlobalRooms();
    let entry = rooms.find((candidate) => matchesProductBindingMetadata(candidate.metadata, bindingMetadata));
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
          focusedAccessToken ??
          (entry.accessToken && entry.accessRole !== "readonly" ? entry.accessToken : undefined);
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

  async queryAttention(input: { sessionId: string } & ProductAttentionQueryInput): Promise<AttentionQueryItem[]> {
    return await this.store.queryAttention(input);
  }

  async commitAttention(input: { sessionId: string } & ProductAttentionCommitInput): Promise<{ commit: unknown }> {
    return await this.store.commitAttention(input);
  }

  async settleAttention(input: { sessionId: string } & ProductAttentionSettleInput): Promise<{ commit: unknown }> {
    return await this.store.settleAttention(input);
  }

  async listDelegations(input: ProductDelegationLookup): Promise<ProductDelegationRecord[]> {
    return await this.store.listProductDelegations(input);
  }

  async createDelegation(input: ProductDelegationCreateInput): Promise<ProductDelegationRecord> {
    return await this.store.createProductDelegation(input);
  }

  async revokeDelegation(input: {
    delegationId: string;
    revokedAt: number;
    revokedReason: string;
  }): Promise<ProductDelegationRecord> {
    return await this.store.revokeProductDelegation(input);
  }
}

export const createProductExtensionRuntimeClient = (
  store: ProductExtensionRuntimeStore,
): ProductExtensionRuntimeClient => new ProductExtensionRuntimeClient(store);
