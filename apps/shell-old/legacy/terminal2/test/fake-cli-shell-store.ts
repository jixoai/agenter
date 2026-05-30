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
  AppEnsureTerminalBindingInput,
  AppTerminalComposedSurfaceState,
  RuntimeClientState,
  SessionEntry,
  WorkspacePrivateTextAssetEnsureOutput,
} from "@agenter/client-sdk";
import type { TerminalBackendKind } from "@agenter/termless-core";

import type { CliShellProductHostStore, CliShellStore } from "../src";

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

const createTerminalEntry = (
  terminalId: string,
  metadata: Record<string, unknown> = {},
  command: string[] = ["/bin/bash"],
  launchCwd = "/repo",
  backend: TerminalBackendKind = "xterm",
  processKind = "shell",
): GlobalTerminalEntry => ({
  terminalId,
  processKind,
  backend,
  command,
  launchCwd,
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
    cursor: { x: 0, y: 0, visible: false },
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

const createRoomEntry = (chatId: string, metadata: Record<string, unknown> = {}, title = chatId): GlobalRoomEntry => ({
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
  avatars: GlobalAvatarCatalogEntry[] = [createAvatarEntry("default")];
  sessions = new Map<string, SessionEntry>();
  terminals: GlobalTerminalEntry[] = [];
  terminalHistory: GlobalTerminalEntry[] = [];
  terminalArchive: GlobalTerminalEntry[] = [];
  lastPublishedComposedSurface: AppTerminalComposedSurfaceState | null = null;
  terminalApprovalRequests = new Map<string, GlobalTerminalApprovalRequest[]>();
  retainedTerminalPermissionRequests: Array<{ terminalId: string | undefined; released: boolean }> = [];
  approvedTerminalRequests: Array<{ terminalId: string; requestId: string; durationMs: number }> = [];
  deniedTerminalRequests: Array<{ terminalId: string; requestId: string }> = [];
  terminalGrants = new Map<string, GlobalTerminalGrantEntry[]>();
  terminalWriteLeases: Array<{
    leaseId: string;
    terminalId: string;
    participantId: GlobalTerminalActorId;
    expiresAt: number;
    revokedAt?: number;
  }> = [];
  focusTerminalCalls: string[][] = [];
  rooms: GlobalRoomEntry[] = [];
  roomGrants = new Map<string, GlobalRoomGrantEntry[]>();
  focusRoomCalls: string[][] = [];
  inputs: Array<{ terminalId: string; text: string }> = [];
  sentMessages: Array<{ chatId: string; text: string }> = [];
  deletedSessions: string[] = [];
  deletedTerminalIds: string[] = [];
  deletedRoomIds: string[] = [];
  private listeners = new Set<() => void>();
  privateAssets = new Map<string, WorkspacePrivateTextAssetEnsureOutput>();
  promptFiles = new Map<string, { path: string; content: string; mtimeMs: number }>();
  avatarPromptFiles = new Map<string, { path: string; content: string; mtimeMs: number }>();
  attentionQueryItems: AttentionQueryItem[] = [];
  lastAttentionCommit: Record<string, unknown> | null = null;
  lastAttentionSettle: Record<string, unknown> | null = null;

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private createDefaultSession(): SessionEntry {
    const firstSession = [...this.sessions.values()][0];
    return firstSession ?? createSessionEntry("/repo", "shell-assistant");
  }

  private createRuntimeState(): RuntimeClientState {
    const session = this.createDefaultSession();
    const terminalSnapshots = Object.fromEntries(
      this.terminals.filter((entry) => entry.snapshot).map((entry) => [entry.terminalId, entry.snapshot!]),
    );
    return {
      connected: true,
      connectionStatus: "connected",
      profileService: null,
      lastEventId: 0,
      sessions: [session],
      runtimes: {
        [session.id]: {
          sessionId: session.id,
          started: true,
          activityState: "active",
          schedulerPhase: "waiting_commits",
          stage: "idle",
          focusedTerminalId: this.terminals[0]?.terminalId ?? null,
          focusedTerminalIds: this.terminals[0]?.terminalId ? [this.terminals[0].terminalId] : [],
          chatMessages: [],
          terminalSnapshots,
          terminalReads: {},
          tasks: [],
          schedulerState: null,
          attention: undefined,
          attentionDelivery: {
            projections: [],
            dispatches: [],
            receipts: [],
            watches: [],
            effects: [],
          },
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 1, timestamp: 1 },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          attentionApi: null,
          terminals: this.terminals.map((entry) => ({
            terminalId: entry.terminalId,
            status: entry.status,
            processPhase: entry.processPhase,
            lifecycleTransition: null,
            seq: entry.seq,
            launchCwd: entry.launchCwd,
          })),
          modelCapabilities: {
            streaming: true,
            tools: true,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: true,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
      activityBySession: { [session.id]: "active" },
      terminalSnapshotsBySession: { [session.id]: terminalSnapshots },
      terminalReadsBySession: { [session.id]: {} },
      chatsBySession: { [session.id]: [] },
      messageChannelsBySession: {},
      chatCyclesBySession: { [session.id]: [] },
      attentionBySession: {},
      attentionDeliveryBySession: {
        [session.id]: {
          projections: [],
          dispatches: [],
          receipts: [],
          watches: [],
          effects: [],
        },
      },
      tasksBySession: { [session.id]: [] },
      recentWorkspaces: [],
      workspaces: [],
      globalAvatarCatalog: this.createCached([]),
      workspaceAvatarCatalogByPath: {},
      globalRooms: this.createCached([...this.rooms]),
      globalRoomSnapshotsById: Object.fromEntries(
        this.rooms.map((room) => [room.chatId, this.createCached(this.createRoomSnapshot(room))]),
      ),
      globalRoomGrantsById: {},
      globalRoomAssetsById: {},
      globalTerminals: this.createCached([...this.terminals]),
      globalTerminalGrantsById: {},
      globalTerminalApprovalsById: Object.fromEntries(
        [...this.terminalApprovalRequests.entries()].map(([terminalId, requests]) => [
          terminalId,
          this.createCached([...requests]),
        ]),
      ),
      globalTerminalActivityById: {},
      schedulerLogsBySession: { [session.id]: [] },
      observabilityTracesBySession: { [session.id]: [] },
      heartbeatGroupsBySession: { [session.id]: this.createCached([]) },
      modelCallsBySession: { [session.id]: [] },
      requestAuxBySession: { [session.id]: [] },
      modelCallDeltasBySession: { [session.id]: [] },
      apiCallsBySession: { [session.id]: [] },
      terminalActivityBySession: { [session.id]: {} },
      apiCallRecordingBySession: { [session.id]: { enabled: false, refCount: 0 } },
      notifications: [],
      unreadBySession: { [session.id]: 0 },
      unreadByBucket: {},
    };
  }

  private createCached<T>(data: T) {
    return {
      data,
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: 0,
    };
  }

  private createRoomSnapshot(room: GlobalRoomEntry): GlobalRoomSnapshotOutput {
    return {
      channel: room,
      items: this.sentMessages
        .filter((message) => message.chatId === room.chatId)
        .map(
          (message, index): GlobalRoomMessage => ({
            rowId: index + 1,
            messageId: index + 1,
            chatId: message.chatId,
            senderActorId: "auth:user",
            from: "you",
            kind: "text",
            content: message.text,
            createdAt: 1_714_560_000_000 + index * 60_000,
            updatedAt: 1_714_560_000_000 + index * 60_000,
            readActorIds: [],
            unreadActorIds: [],
            metadata: {},
            attachments: [],
          }),
        ),
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: String(this.sentMessages.length),
    };
  }

  getState(): RuntimeClientState {
    return this.createRuntimeState();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {}

  disconnect(): void {}

  async hydrateSessionArtifacts(
    _sessionId: string,
    _input?: { includeChatHistory?: boolean; observabilityMode?: "heartbeat" | "full" },
  ): Promise<void> {}

  retainGlobalTerminals(): () => void {
    return () => {};
  }

  retainTerminalPermissionRequests(input: { terminalId?: string } = {}): () => void {
    const record = { terminalId: input.terminalId, released: false };
    this.retainedTerminalPermissionRequests.push(record);
    return () => {
      record.released = true;
    };
  }

  async hydrateGlobalTerminalApprovals(input: {
    terminalId: string;
    force?: boolean;
  }): Promise<GlobalTerminalApprovalRequest[]> {
    void input.force;
    return [...(this.terminalApprovalRequests.get(input.terminalId) ?? [])];
  }

  async approveGlobalTerminalRequest(input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
  }): Promise<{ leaseId: string; participantId: GlobalTerminalActorId; expiresAt: number }> {
    this.approvedTerminalRequests.push(input);
    const requests = this.terminalApprovalRequests.get(input.terminalId) ?? [];
    this.terminalApprovalRequests.set(
      input.terminalId,
      requests.filter((request) => request.requestId !== input.requestId),
    );
    this.emit();
    return {
      leaseId: `lease:${input.terminalId}:${input.requestId}`,
      participantId: "auth:shell-assistant" as GlobalTerminalActorId,
      expiresAt: Date.now() + input.durationMs,
    };
  }

  async denyGlobalTerminalRequest(input: {
    terminalId: string;
    requestId: string;
  }): Promise<{ ok: true; requestId: string; terminalId: string }> {
    this.deniedTerminalRequests.push(input);
    const requests = this.terminalApprovalRequests.get(input.terminalId) ?? [];
    this.terminalApprovalRequests.set(
      input.terminalId,
      requests.filter((request) => request.requestId !== input.requestId),
    );
    this.emit();
    return { ok: true, requestId: input.requestId, terminalId: input.terminalId };
  }

  retainGlobalRoomSnapshot(_chatId: string): () => void {
    return () => {};
  }

  async autoLogin() {
    return { ok: true as const, session: { token: "superadmin-token" } };
  }

  async getAuthSession(): Promise<AuthSessionOutput | null> {
    return this.authToken ? this.authSession : null;
  }

  setAuthToken(token: string | null | undefined): void {
    this.authToken = token?.trim() || null;
  }

  async createSession(input: {
    cwd: string;
    name?: string;
    avatar?: string;
    autoStart?: boolean;
  }): Promise<SessionEntry> {
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

  async startSession(sessionId: string): Promise<void> {
    const entry = [...this.sessions.entries()].find(([, session]) => session.id === sessionId);
    if (!entry) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const [key, session] = entry;
    this.sessions.set(key, {
      ...session,
      status: "running",
    });
  }

  async listSessions(): Promise<SessionEntry[]> {
    return [...this.sessions.values()];
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.deletedSessions.push(sessionId);
    for (const [key, session] of [...this.sessions.entries()]) {
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
    const created = {
      ...createAvatarEntry(input.nickname),
      displayName: input.displayName ?? input.nickname,
      classify: input.classify ?? null,
    };
    this.avatars.push(created);
    return created;
  }

  async readSettings(
    sessionId: string,
    _kind: "settings" | "agenter",
  ): Promise<{ path: string; content: string; mtimeMs: number }> {
    return this.promptFiles.get(sessionId) ?? { path: `/tmp/${sessionId}/AGENTER.mdx`, content: "", mtimeMs: 0 };
  }

  async saveSettings(input: { sessionId: string; kind: "settings" | "agenter"; content: string; baseMtimeMs: number }) {
    const current = await this.readSettings(input.sessionId, input.kind);
    if (current.mtimeMs !== input.baseMtimeMs) {
      return { ok: false as const, reason: "conflict" as const, latest: current };
    }
    const saved = { path: current.path, content: input.content, mtimeMs: Date.now() };
    this.promptFiles.set(input.sessionId, saved);
    return { ok: true as const, file: saved };
  }

  async ensureAvatarPromptSeed(input: {
    avatarPrincipalId: string;
    kind: "agenter";
    seedContent: string;
  }): Promise<{ seeded: boolean; file: { path: string; content: string; mtimeMs: number } }> {
    const key = `~:${input.avatarPrincipalId}:${input.kind}`;
    const current = this.avatarPromptFiles.get(key);
    if (current) {
      return {
        seeded: false,
        file: current,
      };
    }
    const saved = {
      path: `/home/.agenter/avatars/by-principal/${input.avatarPrincipalId}/AGENTER.mdx`,
      content: input.seedContent,
      mtimeMs: Date.now(),
    };
    this.avatarPromptFiles.set(key, saved);
    return {
      seeded: true,
      file: saved,
    };
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminals];
  }

  async listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminalHistory];
  }

  async listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminals, ...this.terminalHistory];
  }

  async listGlobalTerminalArchive(): Promise<GlobalTerminalEntry[]> {
    return [...this.terminalArchive];
  }

  async hydrateGlobalTerminals(_input?: { force?: boolean }): Promise<GlobalTerminalEntry[]> {
    return await this.listGlobalTerminals();
  }

  async readGlobalTerminal(input: { terminalId: string }): Promise<{
    terminalId: string;
    representation: "snapshot";
    snapshot: NonNullable<GlobalTerminalEntry["snapshot"]>;
  }> {
    const terminal = this.terminals.find((entry) => entry.terminalId === input.terminalId);
    if (!terminal?.snapshot) {
      throw new Error(`terminal snapshot missing: ${input.terminalId}`);
    }
    return {
      terminalId: input.terminalId,
      representation: "snapshot",
      snapshot: terminal.snapshot,
    };
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    backend?: TerminalBackendKind;
    command?: string[];
    cwd?: string;
    profile?: NonNullable<AppEnsureTerminalBindingInput["createInput"]>["profile"];
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    void input.processKind;
    void input.profile;
    void input.start;
    void input.focus;
    const isComposedTerminal = input.metadata?.terminalRuntimeKind === "composed";
    const sourceTerminalId =
      typeof input.metadata?.projectionSourceTerminalId === "string" ? input.metadata.projectionSourceTerminalId : null;
    const sourceTerminal = sourceTerminalId
      ? (this.terminals.find((entry) => entry.terminalId === sourceTerminalId) ?? null)
      : null;
    const terminal = createTerminalEntry(
      input.terminalId ?? `terminal-${this.terminals.length + 1}`,
      input.metadata ?? {},
      sourceTerminal?.command ?? input.command ?? (isComposedTerminal ? [] : ["/bin/bash"]),
      sourceTerminal?.launchCwd ?? input.cwd ?? "/repo",
      input.backend ?? "xterm",
      input.processKind ?? (isComposedTerminal ? "app" : "shell"),
    );
    if (sourceTerminal?.snapshot) {
      terminal.snapshot = structuredClone(sourceTerminal.snapshot);
      terminal.seq = sourceTerminal.seq;
      terminal.status = sourceTerminal.status;
      terminal.processPhase = sourceTerminal.processPhase;
      terminal.transportUrl = `ws://127.0.0.1/pty/${terminal.terminalId}`;
    }
    this.terminals.push(terminal);
    return { ok: true, message: "terminal created", terminal };
  }

  async setGlobalTerminalConfig(input: {
    terminalId: string;
    processKind?: string;
    backend?: TerminalBackendKind;
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
      throw new Error(`terminal missing: ${input.terminalId}`);
    }
    const current = this.terminals[index]!;
    this.terminals[index] = {
      ...current,
      processKind: input.processKind ?? current.processKind,
      backend: input.backend ?? current.backend,
      command: input.command ? [...input.command] : current.command,
      launchCwd: input.launchCwd ?? current.launchCwd,
      metadata: {
        ...current.metadata,
        ...(input.metadata ?? {}),
      },
      configuredTitle: input.title ?? current.configuredTitle,
      icon: input.icon ?? current.icon,
      shortcuts: input.shortcuts ?? current.shortcuts,
    };
    return { ok: true };
  }

  async publishGlobalTerminalComposedSurface(input: {
    terminalId: string;
    surface: AppTerminalComposedSurfaceState;
  }): Promise<GlobalTerminalEntry> {
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      throw new Error(`terminal missing: ${input.terminalId}`);
    }
    const current = this.terminals[index]!;
    const next: GlobalTerminalEntry = {
      ...current,
      seq: current.seq + 1,
      metadata: {
        ...current.metadata,
        composedFrameSeq: input.surface.seq ?? (current.snapshot?.seq ?? 0) + 1,
        composedFrameMetadata: input.surface.metadata ? { ...input.surface.metadata } : {},
        composedSelectionSources: input.surface.selectionSources?.map((source) => ({ ...source })),
      },
      snapshot: {
        seq: input.surface.seq ?? (current.snapshot?.seq ?? 0) + 1,
        timestamp: Date.now(),
        cols: input.surface.cols,
        rows: input.surface.rows,
        lines: [...input.surface.lines],
        richLines: input.surface.richLines?.map((line) => ({
          spans: line.spans.map((span) => ({ ...span })),
        })),
        cursor: { ...input.surface.cursor },
        scrollback: { ...input.surface.scrollback },
      },
    };
    this.lastPublishedComposedSurface = structuredClone(input.surface);
    this.terminals[index] = next;
    this.emit();
    return next;
  }

  async bootstrapGlobalTerminal(input: {
    terminalId: string;
    recoveryIntent?: "killed-history";
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const index = this.terminals.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      return { ok: false, message: "terminal missing" };
    }
    const terminal = {
      ...this.terminals[index]!,
      processPhase: "running" as const,
      status: "IDLE" as const,
    };
    this.terminals[index] = terminal;
    return { ok: true, message: "terminal bootstrapped", terminal };
  }

  async deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const before = this.terminals.length;
    this.terminals = this.terminals.filter((entry) => entry.terminalId !== input.terminalId);
    this.terminalHistory = this.terminalHistory.filter((entry) => entry.terminalId !== input.terminalId);
    this.deletedTerminalIds.push(input.terminalId);
    return {
      ok: this.terminals.length < before,
      message: this.terminals.length < before ? "terminal deleted" : "unknown terminal",
    };
  }

  async archiveGlobalTerminal(input: { terminalId: string }): Promise<GlobalTerminalEntry> {
    const index = this.terminalHistory.findIndex((entry) => entry.terminalId === input.terminalId);
    if (index === -1) {
      throw new Error(`terminal missing: ${input.terminalId}`);
    }
    const next = {
      ...this.terminalHistory[index]!,
      archivedAt: Date.now(),
    } satisfies GlobalTerminalEntry;
    this.terminalHistory.splice(index, 1);
    this.terminalArchive.push(next);
    return next;
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
    const grants = this.terminalGrants.get(input.terminalId) ?? [];
    grants.push({
      grantId: `grant:${input.terminalId}:${input.participantId}`,
      terminalId: input.terminalId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      createdAt: Date.now(),
    });
    this.terminalGrants.set(input.terminalId, grants);
    return { ok: true, accessToken: `grant-token:${input.terminalId}:${input.participantId}` };
  }

  async revokeGlobalTerminalGrant(input: { terminalId: string; grantId: string }): Promise<{ ok: boolean }> {
    const grants = this.terminalGrants.get(input.terminalId) ?? [];
    const next = grants.filter((grant) => grant.grantId !== input.grantId);
    this.terminalGrants.set(input.terminalId, next);
    return { ok: next.length !== grants.length };
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
    this.focusTerminalCalls.push([...input.terminalIds]);
    return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
  }

  async grantGlobalTerminalWriteLease(input: {
    terminalId: string;
    participantId: GlobalTerminalActorId;
    durationMs: number;
  }): Promise<{ leaseId: string; participantId: GlobalTerminalActorId; expiresAt: number }> {
    const lease = {
      leaseId: `lease:${input.terminalId}:${input.participantId}:${this.terminalWriteLeases.length + 1}`,
      terminalId: input.terminalId,
      participantId: input.participantId,
      expiresAt: Date.now() + input.durationMs,
    };
    this.terminalWriteLeases = this.terminalWriteLeases
      .map((record) =>
        record.terminalId === input.terminalId &&
        record.participantId === input.participantId &&
        record.revokedAt === undefined
          ? { ...record, revokedAt: Date.now() }
          : record,
      )
      .concat(lease);
    return {
      leaseId: lease.leaseId,
      participantId: lease.participantId,
      expiresAt: lease.expiresAt,
    };
  }

  async revokeGlobalTerminalWriteLease(input: {
    terminalId: string;
    leaseId?: string;
    participantId?: GlobalTerminalActorId;
  }): Promise<{ ok: true; revokedCount: number }> {
    let revokedCount = 0;
    this.terminalWriteLeases = this.terminalWriteLeases.map((record) => {
      const matchesLease = input.leaseId ? record.leaseId === input.leaseId : false;
      const matchesParticipant = input.participantId ? record.participantId === input.participantId : false;
      const matches = record.terminalId === input.terminalId && (matchesLease || matchesParticipant);
      if (!matches || record.revokedAt !== undefined) {
        return record;
      }
      revokedCount += 1;
      return {
        ...record,
        revokedAt: Date.now(),
      };
    });
    return { ok: true, revokedCount };
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
    grants.push({
      grantId: `grant:${input.chatId}:${input.participantId}`,
      chatId: input.chatId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `grant-token:${input.chatId}:${input.participantId}`,
      createdAt: Date.now(),
    });
    this.roomGrants.set(input.chatId, grants);
    return { ok: true, accessToken: `grant-token:${input.chatId}:${input.participantId}` };
  }

  async focusMessageChannels(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<GlobalRoomEntry[]> {
    void input.sessionId;
    void input.op;
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return this.rooms.filter((entry) => input.channels.some((channel) => channel.chatId === entry.chatId));
  }

  async focusGlobalRooms(input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }> {
    this.focusRoomCalls.push(input.channels.map((channel) => channel.chatId));
    return { ok: true, message: "focused", focusedChatIds: input.channels.map((channel) => channel.chatId) };
  }

  async hydrateGlobalRoomSnapshot(input: { chatId: string }): Promise<GlobalRoomSnapshotOutput> {
    const room = this.rooms.find((entry) => entry.chatId === input.chatId) ?? createRoomEntry(input.chatId);
    return this.createRoomSnapshot(room);
  }

  async sendGlobalRoomMessage(input: { chatId: string; text: string }): Promise<{ ok: true }> {
    this.sentMessages.push({ chatId: input.chatId, text: input.text });
    this.emit();
    return { ok: true };
  }

  async deleteGlobalRoom(input: { chatId: string }): Promise<GlobalRoomEntry> {
    const room = this.rooms.find((entry) => entry.chatId === input.chatId) ?? createRoomEntry(input.chatId);
    this.rooms = this.rooms.filter((entry) => entry.chatId !== input.chatId);
    this.deletedRoomIds.push(input.chatId);
    return room;
  }

  async inputGlobalTerminal(input: { terminalId: string; text: string }): Promise<{ ok: true }> {
    this.inputs.push({ terminalId: input.terminalId, text: input.text });
    return { ok: true };
  }

  async ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput> {
    const key = `${input.workspacePath}:${input.avatarNickname}:${input.assetKind}:${input.relativePath}`;
    const current = this.privateAssets.get(key);
    if (current) {
      return current;
    }
    const created = { path: input.relativePath, created: true, content: input.seedContent, mtimeMs: Date.now() };
    this.privateAssets.set(key, created);
    return created;
  }

  async queryAttention(input: {
    sessionId: string;
    query: string;
    offset?: number;
    limit?: number;
  }): Promise<AttentionQueryItem[]> {
    void input;
    return [...this.attentionQueryItems];
  }

  async commitAttention(input: { sessionId: string; contextId: string }): Promise<{ commit: unknown }> {
    this.lastAttentionCommit = input;
    return { commit: { contextId: input.contextId } };
  }

  async settleAttention(input: { sessionId: string; contextId: string }): Promise<{ commit: unknown }> {
    this.lastAttentionSettle = input;
    return { commit: { contextId: input.contextId } };
  }
}

export type FakeCliShellProductHostStore = FakeCliShellStore & CliShellProductHostStore;

export const createFakeCliShellProductHostStore = (): FakeCliShellProductHostStore =>
  new FakeCliShellStore() as FakeCliShellProductHostStore;
