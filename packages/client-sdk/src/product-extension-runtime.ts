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
  listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]>;
  issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown>;
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

export interface ProductEnsureTerminalBindingInput {
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
    const terminalId = input.terminalId ?? input.binding.resourceKey;
    const shouldStart = input.createInput?.start ?? false;
    const terminals = await this.store.listGlobalTerminals();
    let entry =
      terminals.find((candidate) => matchesProductBindingMetadata(candidate.metadata, bindingMetadata)) ??
      terminals.find((candidate) => candidate.terminalId === terminalId);
    let created = false;
    if (!entry) {
      const result = await this.store.createGlobalTerminal({
        terminalId,
        processKind: input.createInput?.processKind,
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
    if (input.participantId) {
      const grants = await this.store.listGlobalTerminalGrants(entry.terminalId);
      const existingGrant = grants.find(
        (grant) => grant.participantId === input.participantId && grant.role === (input.grantRole ?? "writer"),
      );
      if (!existingGrant) {
        await this.store.issueGlobalTerminalGrant({
          terminalId: entry.terminalId,
          role: input.grantRole ?? "writer",
          participantId: input.participantId,
          label: input.participantLabel,
        });
        granted = true;
      }
    }

    const focused = input.focus ?? true;
    if (!created && focused) {
      await this.store.focusGlobalTerminals({
        op: "add",
        terminalIds: [entry.terminalId],
      });
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
    if (input.participantId) {
      const grants = await this.store.listGlobalRoomGrants({
        chatId: entry.chatId,
      });
      const existingGrant = grants.find(
        (grant) => grant.participantId === input.participantId && grant.role === (input.grantRole ?? "member"),
      );
      if (!existingGrant) {
        await this.store.issueGlobalRoomGrant({
          chatId: entry.chatId,
          role: input.grantRole ?? "member",
          participantId: input.participantId,
          label: input.participantLabel,
        });
        granted = true;
      }
    }

    const focused = input.focus ?? true;
    if (!created && focused) {
      await this.store.focusGlobalRooms({
        op: "add",
        channels: [{ chatId: entry.chatId }],
      });
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
