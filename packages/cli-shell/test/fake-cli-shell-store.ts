import type { ProductDelegationCreateInput } from "@agenter/product-extension-runtime";
import type {
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  ProductEnsureTerminalBindingInput,
  ProductDelegationRecord,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "@agenter/client-sdk";

import type { CliShellStore } from "../src";

const nowIso = () => new Date().toISOString();

const createSessionEntry = (workspacePath: string, avatar: string): SessionEntry => ({
  id: `session:${workspacePath}:${avatar}`,
  name: avatar,
  cwd: workspacePath,
  workspacePath,
  avatar,
  avatarPrincipalId: `auth:${avatar}` as SessionEntry["avatarPrincipalId"],
  createdAt: nowIso(),
  updatedAt: nowIso(),
  status: "running",
  storageState: "active",
  sessionRoot: `/tmp/${avatar}`,
  storeTarget: "global",
});

const createAvatarEntry = (nickname: string): GlobalAvatarCatalogEntry => ({
  avatarPrincipalId: `auth:${nickname}`,
  runtimeId: `runtime:${nickname}`,
  nickname,
  displayName: nickname,
  classify: null,
  iconUrl: null,
  defaultAvatar: nickname === "default",
  sourceScope: "global",
  globalAvailable: true,
  workspacePrivateSlotReady: false,
  globalPath: `/global/${nickname}`,
  workspacePrivatePath: `/workspace/.agenter/avatars/by-principal/${nickname}`,
  effectivePath: `/global/${nickname}`,
});

const createTerminalEntry = (terminalId: string, metadata: Record<string, unknown> = {}): GlobalTerminalEntry => ({
  terminalId,
  processKind: "shell",
  command: ["/bin/bash"],
  launchCwd: "/repo",
  workspace: null,
  status: "IDLE",
  processPhase: "running",
  seq: 1,
  snapshot: {
    seq: 1,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: Array.from({ length: 24 }, () => ""),
    cursor: { x: 0, y: 0 },
  },
  focused: false,
  icon: undefined,
  configuredTitle: terminalId,
  currentTitle: undefined,
  currentPath: undefined,
  shortcuts: undefined,
  rendererPreference: "auto",
  theme: "default-dark",
  cursor: "block",
  font: {
    family: "monospace",
    sizePx: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    weight: "400",
    weightBold: "700",
    ligatures: false,
  },
  transportUrl: `ws://127.0.0.1/pty/${terminalId}`,
  currentAdminId: null,
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  access: {
    role: "admin",
    accessToken: `tok:${terminalId}`,
    participantId: "system:trusted-terminal-bootstrap",
    currentAdmin: true,
  },
  actors: [],
  metadata,
});

const createRoomEntry = (
  chatId: string,
  metadata: Record<string, unknown> = {},
  title = chatId,
): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title,
  owner: "ops",
  participants: [{ id: "auth:user", label: "User" }],
  metadata,
  createdAt: 1,
  updatedAt: 1,
  focused: false,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

export class FakeCliShellStore implements CliShellStore {
  authToken: string | null = null;
  avatars: GlobalAvatarCatalogEntry[] = [createAvatarEntry("default")];
  sessions = new Map<string, SessionEntry>();
  terminals: GlobalTerminalEntry[] = [];
  terminalGrants = new Map<string, GlobalTerminalGrantEntry[]>();
  focusTerminalCalls: string[][] = [];
  rooms: GlobalRoomEntry[] = [];
  roomGrants = new Map<string, GlobalRoomGrantEntry[]>();
  focusRoomCalls: string[][] = [];
  privateAssets = new Map<string, WorkspacePrivateTextAssetEnsureOutput>();
  delegations: ProductDelegationRecord[] = [];
  promptFiles = new Map<string, { path: string; content: string; mtimeMs: number }>();

  async autoLogin() {
    return { ok: true as const, session: { token: "superadmin-token" } };
  }

  setAuthToken(token: string | null | undefined): void {
    this.authToken = token?.trim() || null;
  }

  async createSession(input: { cwd: string; name?: string; avatar?: string; autoStart?: boolean }): Promise<SessionEntry> {
    const avatar = input.avatar ?? "default";
    const key = `${input.cwd}:${avatar}`;
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }
    const created = createSessionEntry(input.cwd, avatar);
    this.sessions.set(key, created);
    this.promptFiles.set(created.id, { path: `/tmp/${created.id}/AGENTER.mdx`, content: "", mtimeMs: 0 });
    return created;
  }

  async hydrateGlobalAvatarCatalog(_input?: { force?: boolean }): Promise<GlobalAvatarCatalogEntry[]> {
    return [...this.avatars];
  }

  async createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry> {
    const created = { ...createAvatarEntry(input.nickname), displayName: input.displayName ?? input.nickname, classify: input.classify ?? null };
    this.avatars.push(created);
    return created;
  }

  async readSettings(
    sessionId: string,
    _kind: "settings" | "agenter" | "system" | "template" | "contract",
  ): Promise<{ path: string; content: string; mtimeMs: number }> {
    return this.promptFiles.get(sessionId) ?? { path: `/tmp/${sessionId}/AGENTER.mdx`, content: "", mtimeMs: 0 };
  }

  async saveSettings(input: {
    sessionId: string;
    kind: "settings" | "agenter" | "system" | "template" | "contract";
    content: string;
    baseMtimeMs: number;
  }) {
    const current = await this.readSettings(input.sessionId, input.kind);
    if (current.mtimeMs !== input.baseMtimeMs) {
      return { ok: false as const, reason: "conflict" as const, latest: current };
    }
    const saved = { path: current.path, content: input.content, mtimeMs: Date.now() };
    this.promptFiles.set(input.sessionId, saved);
    return { ok: true as const, file: saved };
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminals];
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: NonNullable<ProductEnsureTerminalBindingInput["createInput"]>["profile"];
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    void input.processKind;
    void input.command;
    void input.cwd;
    void input.profile;
    void input.start;
    void input.focus;
    const terminal = createTerminalEntry(input.terminalId ?? `terminal-${this.terminals.length + 1}`, input.metadata ?? {});
    this.terminals.push(terminal);
    return { ok: true, message: "terminal created", terminal };
  }

  async listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]> {
    return [...(this.terminalGrants.get(terminalId) ?? [])];
  }

  async issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown> {
    void input.accessTokenHint;
    void input.adminCandidateRank;
    const grants = this.terminalGrants.get(input.terminalId) ?? [];
    grants.push({ grantId: `grant:${input.terminalId}:${input.participantId}`, terminalId: input.terminalId, role: input.role, participantId: input.participantId, label: input.label, createdAt: Date.now() });
    this.terminalGrants.set(input.terminalId, grants);
    return { ok: true };
  }

  async focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async listGlobalRooms(_input?: { includeArchived?: boolean }): Promise<GlobalRoomEntry[]> {
    return [...this.rooms];
  }

  async createGlobalRoom(input: {
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
  }): Promise<GlobalRoomEntry> {
    void input.participants;
    void input.initialUsers;
    void input.adminToken;
    void input.focus;
    const room = createRoomEntry(
      input.chatId ?? `room-${this.rooms.length + 1}`,
      input.metadata ?? {},
      input.title ?? input.chatId ?? `room-${this.rooms.length + 1}`,
    );
    this.rooms.push(room);
    return room;
  }

  async listGlobalRoomGrants(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomGrantEntry[]> {
    void input.accessToken;
    return [...(this.roomGrants.get(input.chatId) ?? [])];
  }

  async issueGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: GlobalRoomActorId;
    label?: string;
    accessTokenHint?: string;
  }): Promise<unknown> {
    void input.accessToken;
    void input.accessTokenHint;
    const grants = this.roomGrants.get(input.chatId) ?? [];
    grants.push({ grantId: `grant:${input.chatId}:${input.participantId}`, chatId: input.chatId, role: input.role, participantId: input.participantId, label: input.label, createdAt: Date.now() });
    this.roomGrants.set(input.chatId, grants);
    return { ok: true };
  }

  async focusGlobalRooms(input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }> {
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return { ok: true, message: "focused", focusedChatIds: input.channels.map((channel) => channel.chatId) };
  }

  async ensureWorkspacePrivateTextAsset(input: { workspacePath: string; avatarNickname: string; assetKind: "skills" | "memory" | "tools" | "archive"; relativePath: string; seedContent: string }): Promise<WorkspacePrivateTextAssetEnsureOutput> {
    const key = `${input.workspacePath}:${input.avatarNickname}:${input.assetKind}:${input.relativePath}`;
    const current = this.privateAssets.get(key);
    if (current) {
      return current;
    }
    const created = { path: input.relativePath, created: true, content: input.seedContent, mtimeMs: Date.now() };
    this.privateAssets.set(key, created);
    return created;
  }

  async queryAttention(input: { sessionId: string; query: string; offset?: number; limit?: number }): Promise<[]> {
    void input;
    return [];
  }

  async commitAttention(input: { sessionId: string; contextId: string }): Promise<{ commit: unknown }> {
    void input;
    return { commit: {} };
  }

  async settleAttention(input: { sessionId: string; contextId: string }): Promise<{ commit: unknown }> {
    void input;
    return { commit: {} };
  }

  async listProductDelegations(input: {
    productId: string;
    resourceKey?: string;
    runtimeId?: string;
    avatarActorId?: string;
    includeRevoked?: boolean;
  }): Promise<ProductDelegationRecord[]> {
    void input;
    return [...this.delegations];
  }

  async createProductDelegation(input: ProductDelegationCreateInput): Promise<ProductDelegationRecord> {
    const created: ProductDelegationRecord = { ...input, delegationId: `delegation:${input.productId}:${input.resourceKey}`, status: "active" };
    this.delegations.push(created);
    return created;
  }

  async revokeProductDelegation(input: { delegationId: string; revokedAt: number; revokedReason: string }): Promise<ProductDelegationRecord> {
    const current = this.delegations.find((record) => record.delegationId === input.delegationId);
    if (!current) {
      throw new Error(`unknown delegation: ${input.delegationId}`);
    }
    const revoked = { ...current, status: "revoked" as const, revokedAt: input.revokedAt, revokedReason: input.revokedReason };
    this.delegations = this.delegations.map((record) => (record.delegationId === input.delegationId ? revoked : record));
    return revoked;
  }
}
