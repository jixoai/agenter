import { accessSync, existsSync, constants as fsConstants, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { normalizeAvatarNickname } from "@agenter/avatar";
import {
  SessionDb,
  type SessionBlockRecord,
  type SessionCollectedInput,
  type SessionCycleRecord,
} from "@agenter/session-system";
import { collectClientMessageIds, toChatCycleId, type ChatCycle } from "./chat-cycles";
import { readGlobalSettingsFile, saveGlobalSettingsFile } from "./global-settings";
import { resolveModelCapabilities } from "./model-capabilities";
import {
  buildAvatarIconUrl,
  buildSessionIconUrl,
  createAvatarCatalogItem,
  listUserAvatarNicknames,
  renderAvatarFallbackSvg,
  renderSessionFallbackSvg,
  resolveAvatarForWorkspace,
  resolveAvatarIconFile,
  resolveAvatarUserRoot,
  resolveSessionIconFile,
  writeAvatarIconUpload,
  writeSessionIconUpload,
} from "./profile-images";
import {
  settingsKindSchema,
  type AnyRuntimeEvent,
  type RuntimeEventEnvelope,
  type RuntimeEventType,
  type RuntimeSnapshotPayload,
} from "./realtime-types";
import { SessionCatalog, type SessionMeta } from "./session-catalog";
import { SessionNotificationRegistry, type SessionNotificationSnapshot } from "./session-notifications";
import { resolveSessionConfig } from "./session-config";
import { buildSessionAssetUrl, toChatSessionAsset } from "./session-assets";
import { SessionRuntime, type RuntimeEvent } from "./session-runtime";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities } from "./types";
import { WorkspacePathSearchIndex } from "./workspace-path-search";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
} from "./workspace-settings";
import { WorkspacesStore, type WorkspaceEntry } from "./workspaces-store";

const now = (): number => Date.now();

const hashNumericLabel = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 100;
  }
  return String(hash).padStart(2, "0");
};

const parseGitOwnerFromUrl = (raw: string): string | null => {
  const value = raw.trim().replace(/\.git$/, "");
  const scpMatch = value.match(/^[^@]+@[^:]+:([^/]+)\/.+$/);
  if (scpMatch?.[1]) {
    return scpMatch[1];
  }
  const sshMatch = value.match(/^ssh:\/\/[^/]+\/([^/]+)\/.+$/);
  if (sshMatch?.[1]) {
    return sshMatch[1];
  }
  const httpsMatch = value.match(/^https?:\/\/[^/]+\/([^/]+)\/.+$/);
  if (httpsMatch?.[1]) {
    return httpsMatch[1];
  }
  return null;
};

const resolveWorkspaceGroup = (workspacePath: string): string => {
  const gitConfigPath = join(workspacePath, ".git", "config");
  if (!existsSync(gitConfigPath)) {
    return "Other";
  }

  try {
    const lines = readFileSync(gitConfigPath, "utf8").split(/\r?\n/);
    let inOriginRemote = false;
    let userName: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        inOriginRemote = trimmed === '[remote "origin"]';
        continue;
      }
      if (inOriginRemote && trimmed.startsWith("url =")) {
        const owner = parseGitOwnerFromUrl(trimmed.slice("url =".length));
        if (owner) {
          return owner;
        }
      }
      if (userName === null && trimmed.startsWith("name =")) {
        userName = trimmed.slice("name =".length).trim();
      }
    }
    if (userName && userName.length > 0) {
      return userName;
    }
  } catch {
    return "Other";
  }

  return "Other";
};

const isRunningSession = (status: SessionMeta["status"]): boolean => status === "running" || status === "starting";

const toChatMessage = (sessionId: string, block: SessionBlockRecord): ChatMessage => ({
  id: `${block.id}`,
  role: block.role,
  content: block.content,
  timestamp: block.createdAt,
  cycleId: block.cycleId,
  channel: block.channel === "user_input" ? undefined : block.channel,
  format: block.format,
  tool: block.tool,
  attachments: block.attachments.map((attachment) => toChatSessionAsset(sessionId, attachment)),
});

const toChatCycle = (input: {
  sessionId: string;
  cycle: SessionCycleRecord;
  inputs: SessionCollectedInput[];
  outputs: SessionBlockRecord[];
  modelCallId: number | null;
}): ChatCycle => ({
  id: toChatCycleId({ cycleId: input.cycle.id }),
  cycleId: input.cycle.id,
  seq: input.cycle.seq,
  createdAt: input.cycle.createdAt,
  wakeSource:
    typeof input.cycle.wake?.source === "string" && input.cycle.wake.source.length > 0 ? input.cycle.wake.source : null,
  kind: input.cycle.result.kind === "compact" ? "compact" : "model",
  status: "done",
  clientMessageIds: collectClientMessageIds(input.inputs),
  inputs: structuredClone(input.inputs),
  outputs: input.outputs.map((block) => toChatMessage(input.sessionId, block)),
  liveMessages: [],
  streaming: null,
  modelCallId: input.modelCallId,
});

const hasCollectedUserMessage = (inputs: SessionCollectedInput[]): boolean =>
  inputs.some((input) => input.source === "message" && input.role === "user");

const blockToCollectedInput = (sessionId: string, block: SessionBlockRecord): SessionCollectedInput => ({
  source: "message",
  role: "user",
  name: "User",
  parts: [
    ...(block.content.trim().length > 0 ? ([{ type: "text", text: block.content }] as const) : []),
    ...block.attachments.map((attachment) => ({
      type: attachment.kind,
      assetId: attachment.id,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      url: buildSessionAssetUrl(sessionId, attachment.id),
    })),
  ],
});

const mergeLegacyCycleInputs = (
  sessionId: string,
  cycles: SessionCycleRecord[],
  orphanUserInputs: SessionBlockRecord[],
): Array<{ cycle: SessionCycleRecord; inputs: SessionCollectedInput[] }> => {
  if (cycles.length === 0 || orphanUserInputs.length === 0) {
    return cycles.map((cycle) => ({ cycle, inputs: cycle.collectedInputs }));
  }

  let orphanIndex = 0;
  return cycles.map((cycle) => {
    if (hasCollectedUserMessage(cycle.collectedInputs)) {
      while (orphanIndex < orphanUserInputs.length && orphanUserInputs[orphanIndex]!.createdAt <= cycle.createdAt) {
        orphanIndex += 1;
      }
      return { cycle, inputs: cycle.collectedInputs };
    }

    const legacyInputs: SessionCollectedInput[] = [];
    while (orphanIndex < orphanUserInputs.length && orphanUserInputs[orphanIndex]!.createdAt <= cycle.createdAt) {
      legacyInputs.push(blockToCollectedInput(sessionId, orphanUserInputs[orphanIndex]!));
      orphanIndex += 1;
    }

    return {
      cycle,
      inputs: legacyInputs.length > 0 ? [...legacyInputs, ...cycle.collectedInputs] : cycle.collectedInputs,
    };
  });
};

const createWorkspaceSessionCounts = (): WorkspaceSessionCounts => ({
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
});

const countWorkspaceSessions = (sessions: SessionMeta[]): WorkspaceSessionCounts => {
  const counts = createWorkspaceSessionCounts();
  for (const session of sessions) {
    if (session.storageState === "archived") {
      counts.archive += 1;
      continue;
    }
    counts.all += 1;
    if (isRunningSession(session.status)) {
      counts.running += 1;
    } else {
      counts.stopped += 1;
    }
  }
  return counts;
};

const sessionSortAt = (session: SessionMeta): string => {
  if (session.storageState === "archived") {
    return session.archivedAt ?? session.updatedAt;
  }
  return session.updatedAt;
};

const compareWorkspaceSessions =
  (favoriteIds: Set<string>) =>
  (left: SessionMeta, right: SessionMeta): number => {
    const leftFavorite = favoriteIds.has(left.id);
    const rightFavorite = favoriteIds.has(right.id);
    if (leftFavorite !== rightFavorite) {
      return leftFavorite ? -1 : 1;
    }
    const sortAtCompare = sessionSortAt(right).localeCompare(sessionSortAt(left));
    if (sortAtCompare !== 0) {
      return sortAtCompare;
    }
    return right.id.localeCompare(left.id);
  };

const matchesWorkspaceTab = (session: SessionMeta, tab: WorkspaceSessionTab): boolean => {
  if (tab === "archive") {
    return session.storageState === "archived";
  }
  if (session.storageState === "archived") {
    return false;
  }
  if (tab === "running") {
    return isRunningSession(session.status);
  }
  if (tab === "stopped") {
    return !isRunningSession(session.status);
  }
  return true;
};

type KernelListener = (event: AnyRuntimeEvent) => void;

export interface AppKernelOptions {
  globalSessionRoot?: string;
  archiveSessionRoot?: string;
  workspacesPath?: string;
  initialWorkspace?: string;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export type WorkspaceSessionTab = "all" | "running" | "stopped" | "archive";

export interface WorkspaceSessionPreview {
  firstUserMessage: string | null;
  latestMessages: string[];
}

export interface WorkspaceSessionEntry {
  sessionId: string;
  name: string;
  status: SessionMeta["status"];
  storageState: SessionMeta["storageState"];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  preview: WorkspaceSessionPreview;
}

export interface WorkspaceSessionCounts {
  all: number;
  running: number;
  stopped: number;
  archive: number;
}

export interface WorkspaceSessionPage {
  items: WorkspaceSessionEntry[];
  nextCursor: number | null;
  counts: WorkspaceSessionCounts;
}

export interface WorkspaceListItem extends WorkspaceEntry {
  group: string;
  missing: boolean;
  counts: WorkspaceSessionCounts;
  lastSessionActivityAt?: string;
}

export class AppKernel {
  private readonly sessions: SessionCatalog;
  private readonly workspaces: WorkspacesStore;
  private readonly runtimes = new Map<string, SessionRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly listeners = new Set<KernelListener>();
  private readonly eventLog: AnyRuntimeEvent[] = [];
  private readonly notifications = new SessionNotificationRegistry();
  private readonly workspacePathSearch = new WorkspacePathSearchIndex();
  private eventSeq = 0;

  constructor(private readonly options: AppKernelOptions = {}) {
    this.sessions = new SessionCatalog({
      globalRoot: options.globalSessionRoot,
      archiveRoot: options.archiveSessionRoot,
    });
    this.workspaces = new WorkspacesStore({ filePath: options.workspacesPath });
  }

  async start(): Promise<void> {
    if (this.options.initialWorkspace) {
      this.workspaces.add(this.options.initialWorkspace);
    }
    this.sessions.refresh(this.workspaces.list());
  }

  async stop(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.stop();
    }
    this.runtimes.clear();
    this.runtimeStopListeners.clear();
  }

  getSnapshot(): RuntimeSnapshotPayload {
    const runtimes = Object.fromEntries(
      [...this.runtimes.entries()].map(([sessionId, runtime]) => [sessionId, runtime.snapshot()]),
    );

    return {
      version: 1,
      timestamp: now(),
      lastEventId: this.eventSeq,
      sessions: this.sessions.list(),
      runtimes,
    };
  }

  onEvent(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEventsAfter(afterEventId: number): AnyRuntimeEvent[] {
    if (afterEventId >= this.eventSeq || this.eventLog.length === 0) {
      return [];
    }
    return this.eventLog.filter((event) => event.eventId > afterEventId);
  }

  listSessions(): SessionMeta[] {
    this.sessions.refresh(this.workspaces.list());
    return this.sessions.list();
  }

  listRecentWorkspaces(limit = 8): string[] {
    return this.workspaces.listRecent(limit);
  }

  listAllWorkspaces(): WorkspaceListItem[] {
    this.sessions.refresh(this.workspaces.list());
    const byWorkspace = new Map<string, SessionMeta[]>();
    for (const session of this.sessions.list()) {
      const list = byWorkspace.get(session.cwd) ?? [];
      list.push(session);
      byWorkspace.set(session.cwd, list);
    }

    return this.workspaces.listEntries().map((entry) => {
      const sessions = byWorkspace.get(entry.path) ?? [];
      const counts = countWorkspaceSessions(sessions);
      const lastSessionActivityAt = sessions
        .map((session) => sessionSortAt(session))
        .sort((left, right) => right.localeCompare(left))[0];
      return {
        ...entry,
        group: resolveWorkspaceGroup(entry.path),
        missing: !this.validateDirectory(entry.path).ok,
        counts,
        lastSessionActivityAt,
      };
    });
  }

  listWorkspaceSessions(input: {
    path: string;
    tab: WorkspaceSessionTab;
    cursor?: number;
    limit?: number;
  }): WorkspaceSessionPage {
    const workspacePath = resolve(input.path);
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    const cursor = Math.max(0, Math.floor(input.cursor ?? 0));
    this.sessions.refresh(this.workspaces.list());
    const favoriteIds = new Set(this.workspaces.favoriteSessionIds());
    const workspaceSessions = this.sessions.list().filter((session) => session.cwd === workspacePath);
    const counts = countWorkspaceSessions(workspaceSessions);
    const filtered = workspaceSessions
      .filter((session) => matchesWorkspaceTab(session, input.tab))
      .sort(compareWorkspaceSessions(favoriteIds));
    const items = filtered.slice(cursor, cursor + limit).map((session) => ({
      sessionId: session.id,
      name: session.name,
      status: session.status,
      storageState: session.storageState,
      favorite: favoriteIds.has(session.id),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      archivedAt: session.archivedAt,
      preview: this.readSessionPreview(session),
    }));

    return {
      items,
      nextCursor: cursor + items.length < filtered.length ? cursor + items.length : null,
      counts,
    };
  }

  toggleWorkspaceFavorite(workspacePath: string): WorkspaceEntry {
    return this.workspaces.toggleWorkspaceFavorite(workspacePath);
  }

  toggleSessionFavorite(sessionId: string): { sessionId: string; favorite: boolean } {
    return this.workspaces.toggleSessionFavorite(sessionId);
  }

  removeWorkspace(workspacePath: string): { removed: boolean } {
    return { removed: this.workspaces.remove(workspacePath) };
  }

  removeMissingWorkspaces(): { removed: string[] } {
    const removed: string[] = [];
    for (const workspacePath of this.workspaces.list()) {
      if (this.validateDirectory(workspacePath).ok) {
        continue;
      }
      if (this.workspaces.remove(workspacePath)) {
        removed.push(workspacePath);
      }
    }
    return { removed };
  }

  listChatMessages(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<
    Omit<ReturnType<SessionRuntime["listChatMessages"]>[number], "attachments"> & {
      attachments: ChatSessionAsset[];
      sessionId: string;
      messageId: string;
      timestamp: number;
    }
  > {
    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatMessagesFromDb(session.sessionRoot, sessionId, afterId, limit);
  }

  listChatMessagesBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<
    Omit<ReturnType<SessionRuntime["listChatMessagesBefore"]>[number], "attachments"> & {
      attachments: ChatSessionAsset[];
      sessionId: string;
      messageId: string;
      timestamp: number;
    }
  > {
    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatMessagesBeforeFromDb(session.sessionRoot, sessionId, beforeId, limit);
  }

  listChatCycles(sessionId: string, limit = 120): ChatCycle[] {
    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatCyclesFromDb(session.sessionRoot, sessionId, limit);
  }

  listChatCyclesBefore(sessionId: string, beforeCycleId: number, limit = 120): ChatCycle[] {
    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatCyclesBeforeFromDb(session.sessionRoot, sessionId, beforeCycleId, limit);
  }

  listDirectories(input: { path?: string; includeHidden?: boolean }): Array<{ name: string; path: string }> {
    const root = resolve(input.path ?? "/");
    const includeHidden = input.includeHidden ?? false;
    try {
      accessSync(root, fsConstants.R_OK);
      const entries = readdirSync(root, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => includeHidden || !entry.name.startsWith("."))
        .map((entry) => ({
          name: entry.name,
          path: join(root, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  validateDirectory(path: string): { ok: boolean; path: string } {
    const resolvedPath = resolve(path);
    try {
      const stat = statSync(resolvedPath);
      if (!stat.isDirectory()) {
        return { ok: false, path: resolvedPath };
      }
      accessSync(resolvedPath, fsConstants.R_OK);
      return { ok: true, path: resolvedPath };
    } catch {
      return { ok: false, path: resolvedPath };
    }
  }

  async resolveDraft(input: { cwd: string; avatar?: string }): Promise<{
    cwd: string;
    avatar?: string;
    provider: {
      providerId: string;
      apiStandard: string;
      vendor?: string;
      profile?: string;
      model: string;
      baseUrl?: string;
    };
    modelCapabilities: ModelCapabilities;
  }> {
    const cwd = resolve(input.cwd);
    const config = await resolveSessionConfig(cwd, { avatar: input.avatar });
    this.workspaces.add(cwd);
    return {
      cwd,
      avatar: input.avatar,
      provider: {
        providerId: config.ai.providerId,
        apiStandard: config.ai.apiStandard,
        vendor: config.ai.vendor,
        profile: config.ai.profile,
        model: config.ai.model,
        baseUrl: config.ai.baseUrl,
      },
      modelCapabilities: resolveModelCapabilities(config.ai),
    };
  }

  searchWorkspacePaths(input: {
    cwd: string;
    query?: string;
    limit?: number;
  }): Array<{ label: string; path: string; isDirectory: boolean; ignored?: boolean }> {
    return this.workspacePathSearch.search(input);
  }

  getSession(sessionId: string): SessionMeta | undefined {
    return this.sessions.get(sessionId);
  }

  async createSession(input: {
    name?: string;
    cwd: string;
    avatar?: string;
    autoStart?: boolean;
  }): Promise<SessionMeta> {
    const validatedWorkspace = this.validateDirectory(input.cwd);
    if (!validatedWorkspace.ok) {
      throw new Error(`invalid workspace directory: ${validatedWorkspace.path}`);
    }

    const workspacePath = validatedWorkspace.path;
    const resolved = await resolveSessionConfig(workspacePath, { avatar: input.avatar });
    this.workspaces.add(workspacePath);

    const session = this.sessions.create({
      name: input.name,
      cwd: workspacePath,
      avatar: resolved.avatar.nickname,
      storeTarget: resolved.sessionStoreTarget,
    });
    this.emit("session.updated", { session }, session.id);

    if (input.autoStart === false) {
      return session;
    }

    return await this.startSession(session.id);
  }

  updateSession(sessionId: string, patch: { name?: string }): SessionMeta {
    const session = this.sessions.update(sessionId, {
      name: patch.name,
    });
    this.emit("session.updated", { session }, session.id);
    return session;
  }

  async deleteSession(sessionId: string): Promise<{ removed: boolean }> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(sessionId);
    }
    this.workspaces.removeSessionFavorite(sessionId);
    const removed = this.sessions.remove(sessionId);
    if (removed) {
      this.emitNotificationSnapshot(this.notifications.removeSession(sessionId), sessionId);
      this.emit("session.deleted", { sessionId, removed }, sessionId);
    }
    return { removed };
  }

  async archiveSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(sessionId);
    }
    const archived = this.sessions.archive(sessionId);
    this.emitNotificationSnapshot(this.notifications.removeSession(sessionId), sessionId);
    this.emit("session.updated", { session: archived }, sessionId);
    return archived;
  }

  async restoreSession(sessionId: string): Promise<SessionMeta> {
    const restored = this.sessions.restore(sessionId);
    this.emit("session.updated", { session: restored }, sessionId);
    return restored;
  }

  async startSession(sessionId: string): Promise<SessionMeta> {
    const meta = this.sessions.get(sessionId);
    if (!meta) {
      throw new Error(`session not found: ${sessionId}`);
    }
    if (meta.storageState === "archived") {
      throw new Error(`session is archived: ${sessionId}`);
    }

    this.workspaces.add(meta.cwd);

    const existing = this.runtimes.get(sessionId);
    if (existing?.isStarted()) {
      const running = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      this.emit("session.updated", { session: running }, sessionId);
      return running;
    }

    this.sessions.update(sessionId, { status: "starting", lastError: undefined });
    const runtime = new SessionRuntime({
      sessionId: meta.id,
      cwd: meta.cwd,
      avatar: meta.avatar,
      sessionRoot: meta.sessionRoot,
      sessionName: meta.name,
      storeTarget: meta.storeTarget,
      logger: this.options.logger,
    });
    runtime.setSessionStatus("starting");

    const unsubscribe = runtime.onEvent((event) => {
      this.forwardRuntimeEvent(meta.id, event);
    });

    this.runtimes.set(sessionId, runtime);
    this.runtimeStopListeners.set(sessionId, unsubscribe);

    try {
      await runtime.start();
      const updated = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      runtime.setSessionStatus("running");
      this.emit("session.updated", { session: updated }, sessionId);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.setSessionStatus("error", message);
      this.detachRuntime(sessionId);
      const failed = this.sessions.update(sessionId, { status: "error", lastError: message });
      this.emit("session.updated", { session: failed }, sessionId);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(sessionId);
    }
    const stopped = this.sessions.update(sessionId, { status: "stopped", lastError: undefined });
    this.emit("session.updated", { session: stopped }, sessionId);
    return stopped;
  }

  focusTerminal(sessionId: string, terminalId: string): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    const ok = runtime.focusTerminal(terminalId);
    return { ok };
  }

  async sendChat(
    sessionId: string,
    text: string,
    assetIds: string[] = [],
    clientMessageId?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      const runtime = await this.ensureRuntime(sessionId);
      runtime.pushUserChat(text, assetIds, clientMessageId);
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, reason };
    }
  }

  async uploadSessionAssets(
    sessionId: string,
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>,
  ): Promise<ChatSessionAsset[]> {
    const runtime = await this.ensureRuntime(sessionId);
    return await runtime.uploadAssets(files);
  }

  getSessionAsset(
    sessionId: string,
    assetId: string,
  ): { filePath: string; mimeType: string; name: string; sizeBytes: number } | null {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      const resolved = runtime.getAsset(assetId);
      if (!resolved) {
        return null;
      }
      return {
        filePath: resolved.filePath,
        mimeType: resolved.asset.mimeType,
        name: resolved.asset.name,
        sizeBytes: resolved.asset.sizeBytes,
      };
    }

    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const dbPath = join(session.sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return null;
    }
    const db = new SessionDb(dbPath);
    try {
      const asset = db.getAssetById(assetId);
      if (!asset) {
        return null;
      }
      return {
        filePath: join(session.sessionRoot, asset.relativePath),
        mimeType: asset.mimeType,
        name: asset.name,
        sizeBytes: asset.sizeBytes,
      };
    } finally {
      db.close();
    }
  }

  async uploadSessionIcon(sessionId: string, file: { bytes: Uint8Array; name: string; mimeType: string }): Promise<{ ok: true; url: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    writeSessionIconUpload(session.sessionRoot, file);
    return {
      ok: true,
      url: buildSessionIconUrl(sessionId),
    };
  }

  getSessionIcon(
    sessionId: string,
  ):
    | { kind: "file"; filePath: string; mimeType: string; sizeBytes: number }
    | { kind: "generated"; svg: string; mimeType: "image/svg+xml" }
    | null {
    this.sessions.refresh(this.workspaces.list());
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const uploaded = resolveSessionIconFile(session.sessionRoot);
    if (uploaded) {
      return {
        kind: "file",
        ...uploaded,
      };
    }
    return {
      kind: "generated",
      svg: renderSessionFallbackSvg({
        sessionId: session.id,
        workspacePath: session.cwd,
        label: String(session.id.replaceAll(/[^0-9]/g, "").slice(-2) || hashNumericLabel(session.id)),
      }),
      mimeType: "image/svg+xml",
    };
  }

  async listAvatarCatalog(): Promise<{ activeAvatar: string; items: Array<{ nickname: string; active: boolean; iconUrl: string }> }> {
    const settings = await readGlobalSettingsFile();
    const nicknames = new Set(listUserAvatarNicknames());
    nicknames.add(settings.activeAvatar);
    return {
      activeAvatar: settings.activeAvatar,
      items: [...nicknames]
        .map((nickname) =>
          createAvatarCatalogItem({
            nickname,
            active: nickname === settings.activeAvatar,
          }),
        )
        .sort((left, right) => {
          if (left.active !== right.active) {
            return left.active ? -1 : 1;
          }
          return left.nickname.localeCompare(right.nickname);
        }),
    };
  }

  async createAvatar(input: { nickname: string }): Promise<{ nickname: string; iconUrl: string }> {
    const nickname = normalizeAvatarNickname(input.nickname);
    mkdirSync(resolveAvatarUserRoot(nickname), { recursive: true });
    return {
      nickname,
      iconUrl: buildAvatarIconUrl(nickname),
    };
  }

  async uploadAvatarIcon(input: {
    nickname: string;
    bytes: Uint8Array;
    name: string;
    mimeType: string;
  }): Promise<{ ok: true; url: string }> {
    const nickname = normalizeAvatarNickname(input.nickname);
    writeAvatarIconUpload(nickname, input);
    return {
      ok: true,
      url: buildAvatarIconUrl(nickname),
    };
  }

  getAvatarIcon(
    input: { nickname: string; workspacePath?: string },
  ):
    | { kind: "file"; filePath: string; mimeType: string; sizeBytes: number }
    | { kind: "generated"; svg: string; mimeType: "image/svg+xml" } {
    const workspacePath = input.workspacePath ? resolve(input.workspacePath) : process.cwd();
    const avatar = resolveAvatarForWorkspace(workspacePath, input.nickname);
    const uploaded = resolveAvatarIconFile(avatar);
    if (uploaded) {
      return {
        kind: "file",
        ...uploaded,
      };
    }
    return {
      kind: "generated",
      svg: renderAvatarFallbackSvg({
        nickname: avatar.nickname,
        label: avatar.nickname.slice(0, 1).toUpperCase(),
      }),
      mimeType: "image/svg+xml",
    };
  }

  listCurrentBranchCycles(sessionId: string, limit = 200) {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listCurrentBranchCycles(limit);
  }

  async rollbackSessionCycle(
    sessionId: string,
    cycleId: number,
  ): Promise<{ ok: boolean; cycleId?: number; reason?: string }> {
    const runtime = await this.ensureRuntime(sessionId);
    return runtime.rollbackToCycle(cycleId);
  }

  async retainApiCallSubscription(sessionId: string): Promise<{ enabled: boolean; refCount: number }> {
    const runtime = await this.ensureRuntime(sessionId);
    return runtime.retainApiCallRecording();
  }

  releaseApiCallSubscription(sessionId: string): { enabled: boolean; refCount: number } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { enabled: false, refCount: 0 };
    }
    return runtime.releaseApiCallRecording();
  }

  listModelCalls(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listModelCalls"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listModelCalls(afterId, limit);
  }

  listModelCallsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listModelCallsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listModelCallsBefore(beforeId, limit);
  }

  listApiCalls(sessionId: string, afterId = 0, limit = 200): Array<ReturnType<SessionRuntime["listApiCalls"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listApiCalls(afterId, limit);
  }

  listApiCallsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listApiCallsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listApiCallsBefore(beforeId, limit);
  }

  listLoopbusStateLogs(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusStateLogs"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusStateLogs(afterId, limit);
  }

  listLoopbusStateLogsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusStateLogsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusStateLogsBefore(beforeId, limit);
  }

  listLoopbusTraces(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusTraces(afterId, limit);
  }

  listLoopbusTracesBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusTracesBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusTracesBefore(beforeId, limit);
  }

  listTasks(sessionId: string): { ok: boolean; tasks: ReturnType<SessionRuntime["snapshot"]>["tasks"] } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false, tasks: [] };
    }
    return { ok: true, tasks: runtime.snapshot().tasks };
  }

  triggerTaskManual(sessionId: string, input: { source: string; id: string }): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.triggerTaskManual(input);
  }

  emitTaskEvent(
    sessionId: string,
    input: { topic: string; payload?: unknown; source?: "api" | "file" | "tool" },
  ): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.emitTaskEvent(input);
  }

  async inspectModelDebug(sessionId: string): Promise<ReturnType<SessionRuntime["inspectModelDebug"]>> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.inspectModelDebug();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    return await this.readPersistedModelDebug(session);
  }

  async readSettings(input: {
    sessionId: string;
    kind: unknown;
  }): Promise<{ path: string; content: string; mtimeMs: number }> {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.readEditable(kind);
  }

  async listSettingsLayers(workspacePath: string) {
    return await listWorkspaceSettingsLayers({ workspacePath });
  }

  async readGlobalSettings() {
    return await readGlobalSettingsFile();
  }

  async saveGlobalSettings(input: { content: string; baseMtimeMs: number }) {
    return await saveGlobalSettingsFile(input);
  }

  async readSettingsLayer(input: {
    workspacePath: string;
    layerId: string;
  }) {
    return await readWorkspaceSettingsLayer(input);
  }

  async saveSettingsLayer(input: {
    workspacePath: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }) {
    return await saveWorkspaceSettingsLayer(input);
  }

  getNotificationSnapshot(): SessionNotificationSnapshot {
    return this.notifications.snapshot();
  }

  setChatVisibility(input: { sessionId: string; visible: boolean; focused: boolean }): SessionNotificationSnapshot {
    const snapshot = this.notifications.setChatVisibility(input) ?? this.notifications.snapshot();
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  consumeNotifications(input: { sessionId: string; upToMessageId?: string | null }): SessionNotificationSnapshot {
    const snapshot = this.notifications.consume(input) ?? this.notifications.snapshot();
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  async saveSettings(input: {
    sessionId: string;
    kind: unknown;
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.saveEditable(kind, input.content, input.baseMtimeMs);
  }

  private async ensureRuntime(sessionId: string): Promise<SessionRuntime> {
    if (this.runtimes.has(sessionId)) {
      return this.runtimes.get(sessionId)!;
    }
    await this.startSession(sessionId);
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      throw new Error(`runtime not found for session ${sessionId}`);
    }
    return runtime;
  }

  private readSessionPreview(session: SessionMeta): WorkspaceSessionPreview {
    try {
      const messages = this.readChatMessagesFromDb(session.sessionRoot, session.id, 0, 1_000);
      if (messages.length === 0) {
        return {
          firstUserMessage: null,
          latestMessages: [],
        };
      }

      const firstUser = messages.find((item) => item.role === "user");
      const latestMessages = messages
        .filter((item) => item.role === "user" || item.channel === "to_user")
        .slice(-3)
        .map((item) => item.content.trim())
        .filter((item) => item.length > 0);

      return {
        firstUserMessage: firstUser?.content.trim() || null,
        latestMessages,
      };
    } catch {
      return {
        firstUserMessage: null,
        latestMessages: [],
      };
    }
  }

  private readChatMessagesFromDb(
    sessionRoot: string,
    sessionId: string,
    afterId: number,
    limit: number,
  ): Array<
    Omit<ReturnType<SessionRuntime["listChatMessages"]>[number], "attachments"> & {
      attachments: ChatSessionAsset[];
      sessionId: string;
      messageId: string;
      timestamp: number;
    }
  > {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }

    const db = new SessionDb(dbPath);
    try {
      return db.listBlocksAfter(afterId, limit).map((item) => ({
        ...item,
        attachments: item.attachments.map((attachment) => toChatSessionAsset(sessionId, attachment)),
        sessionId,
        messageId: `${item.id}`,
        timestamp: item.createdAt,
      }));
    } finally {
      db.close();
    }
  }

  private async readPersistedModelDebug(session: SessionMeta): Promise<ReturnType<SessionRuntime["inspectModelDebug"]>> {
    const resolved = await resolveSessionConfig(session.cwd, { avatar: session.avatar });
    const dbPath = join(session.sessionRoot, "session.db");

    if (!existsSync(dbPath)) {
      return {
        config: {
          providerId: resolved.ai.providerId,
          apiStandard: resolved.ai.apiStandard,
          vendor: resolved.ai.vendor,
          profile: resolved.ai.profile,
          extensions: resolved.ai.extensions,
          model: resolved.ai.model,
          baseUrl: resolved.ai.baseUrl,
          apiKey: resolved.ai.apiKey,
          apiKeyEnv: resolved.ai.apiKeyEnv,
          headers: resolved.ai.headers,
          temperature: resolved.ai.temperature,
          maxRetries: resolved.ai.maxRetries,
          maxToken: resolved.ai.maxToken,
          compactThreshold: resolved.ai.compactThreshold,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        history: [],
        stats: null,
        latestModelCall: null,
        recentModelCalls: [],
        recentApiCalls: [],
      };
    }

    const db = new SessionDb(dbPath);
    try {
      return {
        config: {
          providerId: resolved.ai.providerId,
          apiStandard: resolved.ai.apiStandard,
          vendor: resolved.ai.vendor,
          profile: resolved.ai.profile,
          extensions: resolved.ai.extensions,
          model: resolved.ai.model,
          baseUrl: resolved.ai.baseUrl,
          apiKey: resolved.ai.apiKey,
          apiKeyEnv: resolved.ai.apiKeyEnv,
          headers: resolved.ai.headers,
          temperature: resolved.ai.temperature,
          maxRetries: resolved.ai.maxRetries,
          maxToken: resolved.ai.maxToken,
          compactThreshold: resolved.ai.compactThreshold,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        history: [],
        stats: null,
        latestModelCall: db.listModelCalls(1)[0] ?? null,
        recentModelCalls: db.listModelCalls(8),
        recentApiCalls: db.listApiCallsAfter(0, 12),
      };
    } finally {
      db.close();
    }
  }

  private readChatMessagesBeforeFromDb(
    sessionRoot: string,
    sessionId: string,
    beforeId: number,
    limit: number,
  ): Array<
    Omit<ReturnType<SessionRuntime["listChatMessagesBefore"]>[number], "attachments"> & {
      attachments: ChatSessionAsset[];
      sessionId: string;
      messageId: string;
      timestamp: number;
    }
  > {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }

    const db = new SessionDb(dbPath);
    try {
      return db.listBlocksBefore(beforeId, limit).map((item) => ({
        ...item,
        attachments: item.attachments.map((attachment) => toChatSessionAsset(sessionId, attachment)),
        sessionId,
        messageId: `${item.id}`,
        timestamp: item.createdAt,
      }));
    } finally {
      db.close();
    }
  }

  private readChatCyclesFromDb(sessionRoot: string, sessionId: string, limit: number): ChatCycle[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }
    const db = new SessionDb(dbPath);
    try {
      const cycles = db.listCurrentBranchCycles(limit);
      const cycleInputs = mergeLegacyCycleInputs(sessionId, cycles, db.listOrphanUserInputBlocks(limit * 4));
      return cycleInputs.map(({ cycle, inputs }) =>
        toChatCycle({
          sessionId,
          cycle,
          inputs,
          outputs: db.listBlocksByCycleId(cycle.id),
          modelCallId: db.getModelCallByCycleId(cycle.id)?.id ?? null,
        }),
      );
    } finally {
      db.close();
    }
  }

  private readChatCyclesBeforeFromDb(
    sessionRoot: string,
    sessionId: string,
    beforeCycleId: number,
    limit: number,
  ): ChatCycle[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }
    const db = new SessionDb(dbPath);
    try {
      const cycles = db.listCurrentBranchCyclesBefore(beforeCycleId, limit);
      const cycleInputs = mergeLegacyCycleInputs(sessionId, cycles, db.listOrphanUserInputBlocks(limit * 4));
      return cycleInputs.map(({ cycle, inputs }) =>
        toChatCycle({
          sessionId,
          cycle,
          inputs,
          outputs: db.listBlocksByCycleId(cycle.id),
          modelCallId: db.getModelCallByCycleId(cycle.id)?.id ?? null,
        }),
      );
    } finally {
      db.close();
    }
  }

  private detachRuntime(sessionId: string): void {
    this.runtimes.delete(sessionId);
    const unsubscribe = this.runtimeStopListeners.get(sessionId);
    if (unsubscribe) {
      unsubscribe();
      this.runtimeStopListeners.delete(sessionId);
    }
  }

  private forwardRuntimeEvent(sessionId: string, event: RuntimeEvent): void {
    switch (event.type) {
      case "chat":
        this.emit("chat.message", { message: event.payload as ChatMessage }, sessionId, event.timestamp);
        this.emitNotificationForMessage(sessionId, event.payload as ChatMessage);
        return;
      case "phase":
        this.emit("runtime.phase", { phase: event.payload.phase }, sessionId, event.timestamp);
        return;
      case "stage":
        this.emit("runtime.stage", { stage: event.payload.stage }, sessionId, event.timestamp);
        return;
      case "stats":
        this.emit("runtime.stats", event.payload, sessionId, event.timestamp);
        return;
      case "focusedTerminal":
        this.emit(
          "runtime.focusedTerminal",
          { terminalIds: event.payload.terminalIds, terminalId: event.payload.terminalId },
          sessionId,
          event.timestamp,
        );
        return;
      case "terminalSnapshot":
        this.emit("terminal.snapshot", event.payload, sessionId, event.timestamp);
        return;
      case "terminalStatus":
        this.emit("terminal.status", event.payload, sessionId, event.timestamp);
        return;
      case "taskUpdated":
        this.emit("task.updated", event.payload, sessionId, event.timestamp);
        return;
      case "taskDeleted":
        this.emit("task.deleted", event.payload, sessionId, event.timestamp);
        return;
      case "taskTriggered":
        this.emit("task.triggered", event.payload, sessionId, event.timestamp);
        return;
      case "taskSourceChanged":
        this.emit("task.source.changed", event.payload, sessionId, event.timestamp);
        return;
      case "loopbusSnapshot":
        this.emit("runtime.loopbus.snapshot", event.payload, sessionId, event.timestamp);
        return;
      case "loopbusStateLog":
        this.emit("runtime.loopbus.stateLog", event.payload, sessionId, event.timestamp);
        return;
      case "loopbusTrace":
        this.emit("runtime.loopbus.trace", event.payload, sessionId, event.timestamp);
        return;
      case "loopbusInputSignal":
        this.emit("runtime.loopbus.inputSignal", event.payload, sessionId, event.timestamp);
        return;
      case "modelCall":
        this.emit("runtime.modelCall", event.payload, sessionId, event.timestamp);
        return;
      case "apiCall":
        this.emit("runtime.apiCall", event.payload, sessionId, event.timestamp);
        return;
      case "apiRecording":
        this.emit("runtime.apiRecording", event.payload, sessionId, event.timestamp);
        return;
      case "cycleUpdated":
        this.emit("runtime.cycle.updated", event.payload, sessionId, event.timestamp);
        return;
      case "error":
        this.emit("runtime.error", event.payload, sessionId, event.timestamp);
        return;
    }
  }

  private emitNotificationSnapshot(snapshot: SessionNotificationSnapshot | null, sessionId?: string): void {
    if (!snapshot) {
      return;
    }
    this.emit("notification.updated", { snapshot }, sessionId);
  }

  private emitNotificationForMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    const snapshot = this.notifications.noteAssistantReply({
      sessionId,
      workspacePath: session.cwd,
      sessionName: session.name,
      message,
    });
    this.emitNotificationSnapshot(snapshot, sessionId);
  }

  private emit<TType extends RuntimeEventType>(
    type: TType,
    payload: unknown,
    sessionId?: string,
    timestamp = now(),
  ): RuntimeEventEnvelope<TType, unknown> {
    const event: RuntimeEventEnvelope<TType, unknown> = {
      version: 1,
      eventId: ++this.eventSeq,
      timestamp,
      type,
      sessionId,
      payload,
    };
    this.eventLog.push(event);
    if (this.eventLog.length > 2048) {
      this.eventLog.splice(0, this.eventLog.length - 2048);
    }
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }
}
