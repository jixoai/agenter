import type {
  AttentionQueryItem,
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalActorId,
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  RuntimeClientState,
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

const createRoomEntry = (chatId: string, metadata: Record<string, unknown>, title: string): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title,
  owner: "ops",
  participants: [],
  metadata,
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

const createTerminalEntry = (
  terminalId: string,
  metadata: Record<string, unknown> = {},
  processPhase: GlobalTerminalEntry["processPhase"] = "running",
): GlobalTerminalEntry => ({
  terminalId,
  processKind: "shell",
  backend: "xterm",
  command: [process.env.SHELL?.trim() || "bash", "-i"],
  launchCwd: "/repo",
  workspace: null,
  status: "IDLE",
  processPhase,
  seq: 1,
  snapshot: {
    seq: 1,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: Array.from({ length: 24 }, () => ""),
    cursor: { x: 0, y: 0 },
    scrollback: {
      viewportOffset: 0,
      totalLines: 24,
      screenLines: 24,
    },
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

export class FakeCliShellStore implements CliShellStore {
  authToken: string | null = null;
  avatars: GlobalAvatarCatalogEntry[] = [createAvatarEntry("default")];
  sessions = new Map<string, SessionEntry>();
  rooms: GlobalRoomEntry[] = [];
  roomGrants = new Map<string, GlobalRoomGrantEntry[]>();
  terminals: GlobalTerminalEntry[] = [];
  terminalGrants = new Map<string, GlobalTerminalGrantEntry[]>();
  terminalApprovalRequests = new Map<string, GlobalTerminalApprovalRequest[]>();
  deletedSessions: string[] = [];
  deletedRoomIds: string[] = [];
  deletedTerminalIds: string[] = [];
  focusTerminalCalls: string[][] = [];
  focusRoomCalls: string[][] = [];
  sentMessages: Array<{ chatId: string; text: string }> = [];
  privateAssets = new Map<string, WorkspacePrivateTextAssetEnsureOutput>();
  promptFiles = new Map<string, { path: string; content: string; mtimeMs: number }>();
  attentionQueryItems: AttentionQueryItem[] = [];
  attentionCommits: Array<{
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    scores?: Record<string, number>;
    meta?: Record<string, unknown>;
  }> = [];
  attentionSettles: Array<{
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    scores?: Record<string, number>;
    reason?: string;
    meta?: Record<string, unknown>;
  }> = [];
  connected = false;

  readonly authSession: AuthSessionOutput = {
    token: "superadmin-token",
    issuedAt: new Date(0).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    claims: {
      authId: "root-superadmin",
      profileId: "profile-root",
      admin: true,
      superadmin: true,
    },
    profile: {
      profileId: "profile-root",
      identifiers: [{ kind: "email", value: "root@example.com" }],
      metadata: {},
      iconUrl: "http://127.0.0.1/icon/root",
      isVirtual: false,
    },
  };

  async autoLogin(): Promise<{ ok: true; session: { token: string } }> {
    return { ok: true, session: { token: this.authSession.token } };
  }

  async getAuthSession(): Promise<AuthSessionOutput | null> {
    return this.authSession;
  }

  setAuthToken(token: string | null | undefined): void {
    this.authToken = token ?? null;
  }

  async listSessions(): Promise<SessionEntry[]> {
    return [...this.sessions.values()];
  }

  async createSession(input: { cwd: string; name?: string; avatar?: string; autoStart?: boolean }): Promise<SessionEntry> {
    void input.autoStart;
    const avatar = input.avatar ?? input.name ?? "shell-assistant";
    const key = `${input.cwd}:${avatar}`;
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }
    const session = createSessionEntry(input.cwd, avatar);
    this.sessions.set(key, session);
    return session;
  }

  async startSession(_sessionId: string): Promise<void> {}

  async deleteSession(sessionId: string): Promise<void> {
    this.deletedSessions.push(sessionId);
    for (const [key, session] of this.sessions.entries()) {
      if (session.id === sessionId) {
        this.sessions.delete(key);
      }
    }
  }

  async hydrateGlobalAvatarCatalog(_input?: { force?: boolean }): Promise<GlobalAvatarCatalogEntry[]> {
    return [...this.avatars];
  }

  async createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry> {
    const avatar = {
      ...createAvatarEntry(input.nickname),
      displayName: input.displayName ?? input.nickname,
      classify: input.classify ?? null,
    };
    this.avatars.push(avatar);
    return avatar;
  }

  async readSettings(_sessionId: string, _kind: "settings" | "agenter"): Promise<{ path: string; content: string; mtimeMs: number }> {
    return { path: "/tmp/settings.json", content: "{}", mtimeMs: 1 };
  }

  async saveSettings(): Promise<{ ok: true; file: { path: string; content: string; mtimeMs: number } }> {
    return { ok: true, file: { path: "/tmp/settings.json", content: "{}", mtimeMs: 1 } };
  }

  async ensureAvatarPromptSeed(input: {
    workspacePath?: string;
    avatarPrincipalId: string;
    kind: "agenter";
    seedContent: string;
  }): Promise<{ seeded: boolean; file: { path: string; content: string; mtimeMs: number } }> {
    const workspacePath = input.workspacePath ?? "/repo";
    const key = `${workspacePath}:${input.avatarPrincipalId}:${input.kind}`;
    const existing = this.promptFiles.get(key);
    if (existing) {
      return { seeded: false, file: existing };
    }
    const file = {
      path: `${workspacePath}/.agenter/avatars/by-principal/${input.avatarPrincipalId}/AGENTER.mdx`,
      content: input.seedContent,
      mtimeMs: Date.now(),
    };
    this.promptFiles.set(key, file);
    return { seeded: true, file };
  }

  async ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput> {
    const key = `${input.workspacePath}:${input.avatarNickname}:${input.assetKind}:${input.relativePath}`;
    const existing = this.privateAssets.get(key);
    if (existing) {
      return existing;
    }
    const output = {
      path: `${input.workspacePath}/.agenter/avatars/by-nickname/${input.avatarNickname}/${input.relativePath}`,
      content: input.seedContent,
      created: true,
      mtimeMs: Date.now(),
    } satisfies WorkspacePrivateTextAssetEnsureOutput;
    this.privateAssets.set(key, output);
    return output;
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminals];
  }

  async createGlobalTerminal(input: {
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
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const terminal = {
      ...createTerminalEntry(input.terminalId ?? `terminal-${this.terminals.length + 1}`, input.metadata ?? {}, input.start === false ? "not_started" : "running"),
      processKind: input.processKind ?? "shell",
      backend: input.backend ?? "xterm",
      command: input.command ?? input.profile?.command ?? [process.env.SHELL?.trim() || "bash", "-i"],
      launchCwd: input.cwd ?? input.profile?.cwd ?? "/repo",
      configuredTitle: input.profile?.title ?? input.terminalId ?? `terminal-${this.terminals.length + 1}`,
      shortcuts: input.profile?.shortcuts,
    } satisfies GlobalTerminalEntry;
    this.terminals.push(terminal);
    return { ok: true, message: "created", terminal };
  }

  async deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }> {
    this.deletedTerminalIds.push(input.terminalId);
    this.terminals = this.terminals.filter((terminal) => terminal.terminalId !== input.terminalId);
    return { ok: true, message: "deleted" };
  }

  async bootstrapGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      return { ok: false, message: "terminal missing" };
    }
    const next = {
      ...this.terminals[index]!,
      processPhase: "running" as const,
      status: "IDLE" as const,
    };
    this.terminals[index] = next;
    return { ok: true, message: "bootstrapped", terminal: next };
  }

  async setGlobalTerminalConfig(input: {
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
  }): Promise<unknown> {
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      throw new Error(`unknown terminal: ${input.terminalId}`);
    }
    const current = this.terminals[index]!;
    this.terminals[index] = {
      ...current,
      processKind: input.processKind ?? current.processKind,
      backend: input.backend ?? current.backend,
      command: input.command ?? current.command,
      launchCwd: input.launchCwd ?? current.launchCwd,
      configuredTitle: input.title ?? current.configuredTitle,
      icon: input.icon ?? current.icon,
      shortcuts: input.shortcuts ?? current.shortcuts,
      metadata: {
        ...current.metadata,
        ...(input.metadata ?? {}),
      },
    };
    return { ok: true };
  }

  async publishGlobalTerminalComposedSurface(): Promise<unknown> {
    throw new Error("composed TerminalSystem surface must not be used by active cli-shell");
  }

  async listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]> {
    return [...(this.terminalGrants.get(terminalId) ?? [])];
  }

  async issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "guard" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<unknown> {
    void input.accessTokenHint;
    void input.adminCandidateRank;
    const grant = {
      grantId: `grant:${input.terminalId}:${input.participantId}:${input.role}`,
      terminalId: input.terminalId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `grant-token:${input.terminalId}:${input.participantId}`,
      createdAt: Date.now(),
    } satisfies GlobalTerminalGrantEntry;
    this.terminalGrants.set(input.terminalId, [...(this.terminalGrants.get(input.terminalId) ?? []), grant]);
    return grant;
  }

  async revokeGlobalTerminalGrant(input: { terminalId: string; grantId: string }): Promise<{ ok: boolean }> {
    const current = this.terminalGrants.get(input.terminalId) ?? [];
    const next = current.filter((grant) => grant.grantId !== input.grantId);
    this.terminalGrants.set(input.terminalId, next);
    return { ok: next.length !== current.length };
  }

  async focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    void input.sessionId;
    void input.op;
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    void input.op;
    void input.accessToken;
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async listGlobalRooms(): Promise<GlobalRoomEntry[]> {
    return [...this.rooms];
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    focus?: boolean;
  }): Promise<GlobalRoomEntry> {
    void input.focus;
    const room = createRoomEntry(input.chatId ?? `room-${this.rooms.length + 1}`, input.metadata ?? {}, input.title ?? "room");
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
    const grant = {
      grantId: `grant:${input.chatId}:${input.participantId}`,
      chatId: input.chatId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      createdAt: Date.now(),
      accessToken: `grant-token:${input.chatId}`,
    } satisfies GlobalRoomGrantEntry;
    this.roomGrants.set(input.chatId, [...(this.roomGrants.get(input.chatId) ?? []), grant]);
    return grant;
  }

  async focusMessageChannels(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<unknown> {
    void input.sessionId;
    void input.op;
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return { ok: true };
  }

  async focusGlobalRooms(): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }> {
    return { ok: true, message: "focused", focusedChatIds: [] };
  }

  async deleteGlobalRoom(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomEntry> {
    void input.accessToken;
    const existing = this.rooms.find((room) => room.chatId === input.chatId);
    this.rooms = this.rooms.filter((room) => room.chatId !== input.chatId);
    this.deletedRoomIds.push(input.chatId);
    return existing ?? createRoomEntry(input.chatId, {}, input.chatId);
  }

  async queryAttention(): Promise<AttentionQueryItem[]> {
    return [...this.attentionQueryItems];
  }

  async commitAttention(input: {
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    scores?: Record<string, number>;
    meta?: Record<string, unknown>;
  }): Promise<{ commit: unknown }> {
    this.attentionCommits.push(input);
    this.attentionQueryItems = this.attentionQueryItems.filter((item) => item.contextId !== input.contextId);
    this.attentionQueryItems.push({
      contextId: input.contextId,
      context: {
        contextId: input.contextId,
        owner: "cli-shell",
        focusState: "focused",
        content: input.body ?? input.summary ?? input.contextId,
        contentFormat: "text/plain",
        scoreMap: input.scores ?? {},
        consumedPushCommitIds: [],
        headCommitId: `commit:${input.contextId}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      commit: {
        commitId: `commit:${input.contextId}`,
        contextId: input.contextId,
        ingressType: "commit",
        parentCommitIds: [],
        scores: input.scores ?? {},
        meta: {
          author: "cli-shell",
          source: "fake-cli-shell-store",
        },
        summary: input.summary ?? input.contextId,
        change: input.body ? { type: "update", value: input.body, format: "text/plain" } : { type: "clean" },
        createdAt: nowIso(),
      },
    });
    return { commit: { contextId: input.contextId } };
  }

  async settleAttention(input: {
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    scores?: Record<string, number>;
    reason?: string;
    meta?: Record<string, unknown>;
  }): Promise<{ commit: unknown }> {
    this.attentionSettles.push(input);
    this.attentionQueryItems = this.attentionQueryItems.filter((item) => item.contextId !== input.contextId);
    return { commit: { contextId: input.contextId } };
  }

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
  }

  getState(): Pick<RuntimeClientState, "globalRoomSnapshotsById" | "globalTerminalApprovalsById"> {
    const approvals = Object.fromEntries(
      [...this.terminalApprovalRequests.entries()].map(([terminalId, data]) => [
        terminalId,
        {
          data,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: 1,
        },
      ]),
    );
    return {
      globalRoomSnapshotsById: {},
      globalTerminalApprovalsById: approvals,
    };
  }

  subscribe(): () => void {
    return () => {};
  }

  retainGlobalRoomSnapshot(_chatId: string): () => void {
    return () => {};
  }

  retainTerminalPermissionRequests(_input?: { terminalId?: string }): () => void {
    return () => {};
  }

  async hydrateGlobalRoomSnapshot(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
    force?: boolean;
  }): Promise<GlobalRoomSnapshotOutput | null> {
    void input.accessToken;
    void input.limit;
    void input.force;
    const channel = this.rooms.find((room) => room.chatId === input.chatId);
    if (!channel) {
      return null;
    }
    return {
      channel,
      items: [] as GlobalRoomMessage[],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "0",
    };
  }

  async pageGlobalRoomMessages(): Promise<{ items: GlobalRoomMessage[]; hasMore: boolean; nextBefore: null }> {
    return { items: [], hasMore: false, nextBefore: null };
  }

  async sendGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    text: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    void input.accessToken;
    this.sentMessages.push({ chatId: input.chatId, text: input.text });
    return { ok: true };
  }

  async hydrateGlobalTerminalApprovals(input: { terminalId: string; force?: boolean }): Promise<GlobalTerminalApprovalRequest[]> {
    void input.force;
    return [...(this.terminalApprovalRequests.get(input.terminalId) ?? [])];
  }

  async approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }): Promise<unknown> {
    void input.durationMs;
    const current = this.terminalApprovalRequests.get(input.terminalId) ?? [];
    this.terminalApprovalRequests.set(
      input.terminalId,
      current.map((request) => (request.requestId === input.requestId ? { ...request, status: "approved" as const } : request)),
    );
    return { ok: true };
  }

  async denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown> {
    const current = this.terminalApprovalRequests.get(input.terminalId) ?? [];
    this.terminalApprovalRequests.set(
      input.terminalId,
      current.map((request) => (request.requestId === input.requestId ? { ...request, status: "denied" as const } : request)),
    );
    return { ok: true };
  }
}
