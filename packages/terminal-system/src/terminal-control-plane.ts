import { homedir } from "node:os";
import { join } from "node:path";

import type { TerminalDirtySliceResult, TerminalGitLogMode, TerminalLogStyle, TerminalStatus } from "./types";
import { ManagedTerminal, type ManagedTerminalConfig, type ManagedTerminalSnapshot } from "./managed-terminal";

export type TerminalFocusOp = "add" | "remove" | "replace" | "clear";
export type TerminalReadMode = "auto" | "diff" | "snapshot";

export interface TerminalShortcutMap {
  [action: string]: string;
}

export interface TerminalProcessProfile {
  command?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  gitLog?: false | TerminalGitLogMode;
  logStyle?: TerminalLogStyle;
  icon?: string;
  title?: string;
  shortcuts?: TerminalShortcutMap;
}

export interface TerminalTransportConfig {
  host?: string;
  port: number | null;
  pathPrefix?: string;
}

export interface TerminalControlPlaneConfig {
  defaults?: TerminalProcessProfile;
  processProfiles?: Record<string, TerminalProcessProfile>;
  terminalProfiles?: Record<string, TerminalProcessProfile>;
  transport?: TerminalTransportConfig;
}

export interface TerminalControlPlaneConfigPatch {
  defaults?: TerminalProcessProfile;
  processProfiles?: Record<string, TerminalProcessProfile>;
  terminalProfiles?: Record<string, TerminalProcessProfile>;
  transport?: Partial<TerminalTransportConfig>;
}

export interface TerminalCreateInput {
  terminalId?: string;
  processKind?: string;
  command?: string[];
  cwd?: string;
  profile?: TerminalProcessProfile;
  start?: boolean;
}

export interface TerminalWriteInput {
  terminalId: string;
  text: string;
  submit?: boolean;
  submitKey?: "enter" | "linefeed";
  submitGapMs?: number;
  returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  readMode?: TerminalReadMode;
}

export interface TerminalReadResult {
  kind: "terminal-diff" | "terminal-snapshot";
  representation: "diff" | "snapshot";
  terminalId: string;
  fromHash?: string | null;
  toHash?: string | null;
  seq?: number;
  cols?: number;
  rows?: number;
  cursor?: { x: number; y: number };
  tail?: string;
  diff?: string;
  bytes?: number;
  status: "IDLE" | "BUSY";
}

export interface TerminalControlPlaneEntry {
  terminalId: string;
  processKind: string;
  command: string[];
  cwd: string;
  workspace: string | null;
  running: boolean;
  status: "IDLE" | "BUSY";
  seq: number;
  focused: boolean;
  icon?: string;
  title?: string;
  shortcuts?: TerminalShortcutMap;
  transportUrl?: string;
}

export interface TerminalTransportEndpoint {
  host: string;
  port: number;
  path: string;
  url: string;
}

export type TerminalTransportClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

export type TerminalTransportServerMessage =
  | {
      type: "snapshot";
      terminalId: string;
      snapshot: ManagedTerminalSnapshot;
      status: TerminalStatus;
    }
  | {
      type: "output";
      terminalId: string;
      data: string;
    }
  | {
      type: "status";
      terminalId: string;
      running: boolean;
      status: TerminalStatus;
    }
  | {
      type: "error";
      terminalId: string;
      message: string;
    };

interface ManagedEntry {
  terminal: ManagedTerminal;
  processKind: string;
  command: string[];
  cwd: string;
  profile: TerminalProcessProfile;
}

interface TerminalTransportSocketData {
  cleanup: Array<() => void>;
  terminalId: string;
}

const createId = (): string => `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultShellCommand = (): string[] => [process.env.SHELL || "/bin/bash"];

const cloneShortcuts = (input?: TerminalShortcutMap): TerminalShortcutMap | undefined =>
  input ? { ...input } : undefined;

const cloneProfile = (input?: TerminalProcessProfile): TerminalProcessProfile => ({
  command: input?.command ? [...input.command] : undefined,
  cwd: input?.cwd,
  cols: input?.cols,
  rows: input?.rows,
  gitLog: input?.gitLog,
  logStyle: input?.logStyle,
  icon: input?.icon,
  title: input?.title,
  shortcuts: cloneShortcuts(input?.shortcuts),
});

const cloneTransportConfig = (input?: TerminalTransportConfig): TerminalTransportConfig => ({
  host: input?.host ?? "127.0.0.1",
  port: input?.port ?? null,
  pathPrefix: input?.pathPrefix ?? "/pty",
});

const mergeProfile = (...profiles: Array<TerminalProcessProfile | undefined>): TerminalProcessProfile => {
  const merged: TerminalProcessProfile = {};
  for (const profile of profiles) {
    if (!profile) {
      continue;
    }
    if (profile.command) {
      merged.command = [...profile.command];
    }
    if (profile.cwd !== undefined) {
      merged.cwd = profile.cwd;
    }
    if (profile.cols !== undefined) {
      merged.cols = profile.cols;
    }
    if (profile.rows !== undefined) {
      merged.rows = profile.rows;
    }
    if (profile.gitLog !== undefined) {
      merged.gitLog = profile.gitLog;
    }
    if (profile.logStyle !== undefined) {
      merged.logStyle = profile.logStyle;
    }
    if (profile.icon !== undefined) {
      merged.icon = profile.icon;
    }
    if (profile.title !== undefined) {
      merged.title = profile.title;
    }
    if (profile.shortcuts) {
      merged.shortcuts = { ...(merged.shortcuts ?? {}), ...profile.shortcuts };
    }
  }
  return merged;
};

const buildSnapshotPayload = (
  terminalId: string,
  snapshot: ManagedTerminalSnapshot,
  status: "IDLE" | "BUSY",
): TerminalReadResult => ({
  kind: "terminal-snapshot",
  representation: "snapshot",
  terminalId,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  tail: snapshot.lines.slice(-20).join("\n"),
  status,
});

const buildDiffPayload = (
  terminalId: string,
  diff: TerminalDirtySliceResult,
  status: "IDLE" | "BUSY",
): TerminalReadResult => ({
  kind: "terminal-diff",
  representation: "diff",
  terminalId,
  fromHash: diff.fromHash,
  toHash: diff.toHash,
  diff: diff.diff,
  bytes: diff.bytes,
  status,
});

const toManagedGitLogMode = (value: TerminalProcessProfile["gitLog"]): false | "normal" | "verbose" => {
  if (value === "normal" || value === "verbose") {
    return value;
  }
  return false;
};

const toTransportPath = (pathPrefix: string, terminalId: string): string =>
  `${pathPrefix.replace(/\/$/, "")}/${encodeURIComponent(terminalId)}`;

const parseClientTransportMessage = (message: string): TerminalTransportClientMessage | null => {
  try {
    const parsed = JSON.parse(message) as TerminalTransportClientMessage;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }
    if (parsed.type === "input" && typeof parsed.data === "string") {
      return parsed;
    }
    if (
      parsed.type === "resize" &&
      typeof parsed.cols === "number" &&
      Number.isFinite(parsed.cols) &&
      typeof parsed.rows === "number" &&
      Number.isFinite(parsed.rows)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

export class TerminalControlPlane {
  private readonly entries = new Map<string, ManagedEntry>();
  private readonly focusedTerminalIds = new Set<string>();
  private readonly snapshotListeners = new Set<(payload: { terminalId: string; snapshot: ManagedTerminalSnapshot }) => void>();
  private readonly statusListeners = new Set<
    (payload: { terminalId: string; running: boolean; status: TerminalStatus }) => void
  >();
  private readonly focusListeners = new Set<(payload: { terminalIds: string[]; terminalId: string | null }) => void>();
  private config: TerminalControlPlaneConfig;
  private transportServer: Bun.Server<TerminalTransportSocketData> | null = null;

  constructor(
    private readonly options: {
      outputRoot?: string;
      defaultShellCommand?: string[];
      initialConfig?: TerminalControlPlaneConfig;
    } = {},
  ) {
    this.config = {
      defaults: cloneProfile(options.initialConfig?.defaults),
      processProfiles: Object.fromEntries(
        Object.entries(options.initialConfig?.processProfiles ?? {}).map(([key, value]) => [key, cloneProfile(value)]),
      ),
      terminalProfiles: Object.fromEntries(
        Object.entries(options.initialConfig?.terminalProfiles ?? {}).map(([key, value]) => [key, cloneProfile(value)]),
      ),
      transport: cloneTransportConfig(options.initialConfig?.transport),
    };
  }

  onSnapshot(listener: (payload: { terminalId: string; snapshot: ManagedTerminalSnapshot }) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  onStatus(listener: (payload: { terminalId: string; running: boolean; status: TerminalStatus }) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onFocus(listener: (payload: { terminalIds: string[]; terminalId: string | null }) => void): () => void {
    this.focusListeners.add(listener);
    return () => {
      this.focusListeners.delete(listener);
    };
  }

  has(terminalId: string): boolean {
    return this.entries.has(terminalId);
  }

  getManagedTerminal(terminalId: string): ManagedTerminal | null {
    return this.entries.get(terminalId)?.terminal ?? null;
  }

  list(): TerminalControlPlaneEntry[] {
    return [...this.entries.entries()].map(([terminalId, entry]) => this.describeEntry(terminalId, entry));
  }

  async create(input: TerminalCreateInput = {}): Promise<TerminalControlPlaneEntry> {
    const terminalId = input.terminalId ?? createId();
    if (this.entries.has(terminalId)) {
      throw new Error(`terminal already exists: ${terminalId}`);
    }

    const processKind = input.processKind ?? "shell";
    const profile = mergeProfile(
      this.config.defaults,
      this.config.processProfiles?.[processKind],
      input.terminalId ? this.config.terminalProfiles?.[input.terminalId] : undefined,
      input.profile,
      {
        command: input.command,
        cwd: input.cwd,
      },
    );
    const command = profile.command ? [...profile.command] : [...(this.options.defaultShellCommand ?? defaultShellCommand())];
    const cwd = profile.cwd ?? homedir();
    const managedConfig: ManagedTerminalConfig = {
      terminalId,
      command,
      cwd,
      cols: profile.cols ?? 120,
      rows: profile.rows ?? 30,
      gitLog: toManagedGitLogMode(profile.gitLog),
      logStyle: profile.logStyle ?? "rich",
      outputRoot: this.options.outputRoot ? join(this.options.outputRoot, terminalId) : undefined,
    };
    const terminal = new ManagedTerminal(managedConfig);
    this.bindTerminalListeners(terminalId, terminal);

    const entry: ManagedEntry = {
      terminal,
      processKind,
      command,
      cwd,
      profile,
    };
    this.entries.set(terminalId, entry);

    if (input.start !== false) {
      terminal.start();
    } else {
      this.emitStatus({ terminalId, running: false, status: terminal.getStatus() });
      this.emitSnapshot({ terminalId, snapshot: terminal.getSnapshot() });
    }

    return this.describeEntry(terminalId, entry);
  }

  start(terminalId: string): TerminalControlPlaneEntry {
    const entry = this.requireEntry(terminalId);
    if (!entry.terminal.isRunning()) {
      entry.terminal.start();
    }
    return this.describeEntry(terminalId, entry);
  }

  async kill(terminalId: string): Promise<{ ok: boolean; message: string }> {
    const entry = this.entries.get(terminalId);
    if (!entry) {
      return { ok: false, message: `unknown terminal: ${terminalId}` };
    }
    await entry.terminal.stop();
    this.entries.delete(terminalId);
    this.focusedTerminalIds.delete(terminalId);
    this.emitFocus();
    return { ok: true, message: "terminal stopped" };
  }

  focus(op: TerminalFocusOp = "replace", terminalIds: string[] = []): string[] {
    const normalized = terminalIds.filter((terminalId) => this.entries.has(terminalId));
    switch (op) {
      case "add":
        for (const terminalId of normalized) {
          this.focusedTerminalIds.add(terminalId);
        }
        break;
      case "remove":
        for (const terminalId of normalized) {
          this.focusedTerminalIds.delete(terminalId);
        }
        break;
      case "replace":
        this.focusedTerminalIds.clear();
        for (const terminalId of normalized) {
          this.focusedTerminalIds.add(terminalId);
        }
        break;
      case "clear":
        this.focusedTerminalIds.clear();
        break;
    }
    this.emitFocus();
    return [...this.focusedTerminalIds];
  }

  getFocusedTerminalIds(): string[] {
    return [...this.focusedTerminalIds];
  }

  getTransportEndpoint(terminalId: string): TerminalTransportEndpoint | null {
    const transport = this.getConfig().transport;
    if (!transport?.port) {
      return null;
    }
    const host = transport.host ?? "127.0.0.1";
    const path = toTransportPath(transport.pathPrefix ?? "/pty", terminalId);
    return {
      host,
      port: transport.port,
      path,
      url: `ws://${host}:${transport.port}${path}`,
    };
  }

  async startTransport(input: { host?: string; port?: number; pathPrefix?: string } = {}): Promise<TerminalTransportConfig> {
    if (this.transportServer) {
      return this.getConfig().transport ?? cloneTransportConfig();
    }

    const host = input.host ?? this.config.transport?.host ?? "127.0.0.1";
    const pathPrefix = input.pathPrefix ?? this.config.transport?.pathPrefix ?? "/pty";
    const requestedPort = input.port ?? this.config.transport?.port ?? 0;

    const server = Bun.serve<TerminalTransportSocketData>({
      hostname: host,
      port: requestedPort,
      fetch: (request, serverInstance) => {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(`${pathPrefix.replace(/\/$/, "")}/`)) {
          return new Response("not found", { status: 404 });
        }
        const terminalId = decodeURIComponent(url.pathname.slice(pathPrefix.replace(/\/$/, "").length + 1));
        const upgraded = serverInstance.upgrade(request, {
          data: { cleanup: [], terminalId },
        });
        return upgraded ? undefined : new Response("upgrade failed", { status: 500 });
      },
      websocket: {
        open: (socket) => {
          const terminalId = socket.data.terminalId;
          const entry = this.entries.get(terminalId);
          if (!entry || !entry.terminal.isRunning()) {
            socket.send(
              JSON.stringify({
                type: "error",
                terminalId,
                message: `unknown or stopped terminal: ${terminalId}`,
              } satisfies TerminalTransportServerMessage),
            );
            socket.close(4404, "terminal-not-found");
            return;
          }

          const cleanup: Array<() => void> = [];
          cleanup.push(
            entry.terminal.onOutput((data) => {
              socket.send(JSON.stringify({ type: "output", terminalId, data } satisfies TerminalTransportServerMessage));
            }),
          );
          cleanup.push(
            entry.terminal.onStatus((running, status) => {
              socket.send(JSON.stringify({ type: "status", terminalId, running, status } satisfies TerminalTransportServerMessage));
              if (!running) {
                socket.close(1000, "terminal-stopped");
              }
            }),
          );
          socket.data.cleanup = cleanup;
          socket.send(
            JSON.stringify({
              type: "snapshot",
              terminalId,
              snapshot: entry.terminal.getSnapshot(),
              status: entry.terminal.getStatus(),
            } satisfies TerminalTransportServerMessage),
          );
        },
        message: (socket, message) => {
          const terminalId = socket.data.terminalId;
          const entry = this.entries.get(terminalId);
          if (!entry || !entry.terminal.isRunning()) {
            socket.send(
              JSON.stringify({
                type: "error",
                terminalId,
                message: `unknown or stopped terminal: ${terminalId}`,
              } satisfies TerminalTransportServerMessage),
            );
            socket.close(4404, "terminal-not-found");
            return;
          }

          const text = typeof message === "string" ? message : Buffer.from(message).toString("utf8");
          const parsed = parseClientTransportMessage(text);
          if (!parsed) {
            socket.send(
              JSON.stringify({
                type: "error",
                terminalId,
                message: "invalid transport message",
              } satisfies TerminalTransportServerMessage),
            );
            return;
          }

          if (parsed.type === "input") {
            entry.terminal.writeRaw(parsed.data);
            return;
          }

          entry.terminal.resize(parsed.cols, parsed.rows);
        },
        close: (socket) => {
          for (const cleanup of socket.data.cleanup) {
            cleanup();
          }
          socket.data.cleanup = [];
        },
      },
    });

    this.transportServer = server;
    this.config = {
      ...this.config,
      transport: {
        host,
        pathPrefix,
        port: server.port ?? requestedPort ?? null,
      },
    };
    return this.getConfig().transport ?? cloneTransportConfig();
  }

  stopTransport(): void {
    this.transportServer?.stop(true);
    this.transportServer = null;
    this.config = {
      ...this.config,
      transport: {
        ...(this.config.transport ?? cloneTransportConfig()),
        port: null,
      },
    };
  }

  async read(
    terminalId: string,
    mode: TerminalReadMode = "auto",
    options: { remark?: boolean } = {},
  ): Promise<TerminalReadResult> {
    const entry = this.requireEntry(terminalId);
    const snapshot = await entry.terminal.read();
    const status = entry.terminal.getStatus();
    const snapshotPayload = buildSnapshotPayload(terminalId, snapshot, status);

    if (entry.profile.gitLog && mode !== "snapshot") {
      const diff = await entry.terminal.sliceDirty({ remark: options.remark ?? false, wait: false });
      if (diff.ok && diff.changed && diff.fromHash !== diff.toHash) {
        const diffPayload = buildDiffPayload(terminalId, diff, status);
        const shouldUseDiff =
          mode === "diff" || (mode === "auto" && JSON.stringify(diffPayload).length <= JSON.stringify(snapshotPayload).length);
        if (shouldUseDiff) {
          return diffPayload;
        }
      }
    }

    return snapshotPayload;
  }

  async snapshot(terminalId: string, options: { remark?: boolean } = {}): Promise<TerminalReadResult> {
    return this.read(terminalId, "snapshot", options);
  }

  async write(input: TerminalWriteInput): Promise<{ ok: boolean; message: string; read?: TerminalReadResult }> {
    const entry = this.requireEntry(input.terminalId);
    if (!entry.terminal.isRunning()) {
      this.start(input.terminalId);
    }
    await entry.terminal.write(input.text, input.submit ?? true, input.submitKey ?? "enter", input.submitGapMs ?? 80);

    if (!input.returnRead) {
      return { ok: true, message: "written" };
    }

    if (typeof input.returnRead === "object") {
      const waitMs = Math.max(input.returnRead.throttleMs ?? 0, input.returnRead.debounceMs ?? 0);
      if (waitMs > 0) {
        await Bun.sleep(waitMs);
      }
    }

    return {
      ok: true,
      message: "written",
      read: await this.read(input.terminalId, input.readMode ?? "auto"),
    };
  }

  waitCommitted(
    terminalId: string,
    input: { fromHash?: string | null } = {},
  ): { promise: Promise<{ toHash: string | null }>; reject: (reason: unknown) => void } {
    return this.requireEntry(terminalId).terminal.waitCommitted(input);
  }

  getHeadHash(terminalId: string): string | null {
    return this.requireEntry(terminalId).terminal.getHeadHash();
  }

  async markDirty(terminalId: string): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    return this.requireEntry(terminalId).terminal.markDirty();
  }

  getSnapshot(terminalId: string): ManagedTerminalSnapshot {
    return this.requireEntry(terminalId).terminal.getSnapshot();
  }

  getStatus(terminalId: string): TerminalStatus {
    return this.requireEntry(terminalId).terminal.getStatus();
  }

  isRunning(terminalId: string): boolean {
    return this.requireEntry(terminalId).terminal.isRunning();
  }

  getConfig(): TerminalControlPlaneConfig {
    return {
      defaults: cloneProfile(this.config.defaults),
      processProfiles: Object.fromEntries(
        Object.entries(this.config.processProfiles ?? {}).map(([key, value]) => [key, cloneProfile(value)]),
      ),
      terminalProfiles: Object.fromEntries(
        Object.entries(this.config.terminalProfiles ?? {}).map(([key, value]) => [key, cloneProfile(value)]),
      ),
      transport: cloneTransportConfig(this.config.transport),
    };
  }

  setConfig(patch: TerminalControlPlaneConfigPatch): TerminalControlPlaneConfig {
    this.config = {
      defaults: patch.defaults ? mergeProfile(this.config.defaults, patch.defaults) : cloneProfile(this.config.defaults),
      processProfiles: {
        ...(this.config.processProfiles ?? {}),
        ...Object.fromEntries(
          Object.entries(patch.processProfiles ?? {}).map(([key, value]) => [key, mergeProfile(this.config.processProfiles?.[key], value)]),
        ),
      },
      terminalProfiles: {
        ...(this.config.terminalProfiles ?? {}),
        ...Object.fromEntries(
          Object.entries(patch.terminalProfiles ?? {}).map(([key, value]) => [key, mergeProfile(this.config.terminalProfiles?.[key], value)]),
        ),
      },
      transport: {
        ...(this.config.transport ?? cloneTransportConfig()),
        ...(patch.transport ?? {}),
        port: patch.transport?.port ?? this.config.transport?.port ?? null,
      },
    };
    return this.getConfig();
  }

  async dispose(): Promise<void> {
    this.stopTransport();
    const terminalIds = [...this.entries.keys()];
    for (const terminalId of terminalIds) {
      await this.kill(terminalId);
    }
  }

  private bindTerminalListeners(terminalId: string, terminal: ManagedTerminal): void {
    terminal.onSnapshot((snapshot) => {
      this.emitSnapshot({ terminalId, snapshot });
    });
    terminal.onStatus((running, status) => {
      this.emitStatus({ terminalId, running, status });
    });
  }

  private requireEntry(terminalId: string): ManagedEntry {
    const entry = this.entries.get(terminalId);
    if (!entry) {
      throw new Error(`unknown terminal: ${terminalId}`);
    }
    return entry;
  }

  private emitSnapshot(payload: { terminalId: string; snapshot: ManagedTerminalSnapshot }): void {
    for (const listener of this.snapshotListeners) {
      listener(payload);
    }
  }

  private emitStatus(payload: { terminalId: string; running: boolean; status: TerminalStatus }): void {
    for (const listener of this.statusListeners) {
      listener(payload);
    }
  }

  private emitFocus(): void {
    const terminalIds = [...this.focusedTerminalIds];
    const payload = {
      terminalIds,
      terminalId: terminalIds[0] ?? null,
    };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
  }

  private describeEntry(terminalId: string, entry: ManagedEntry): TerminalControlPlaneEntry {
    const snapshot = entry.terminal.getSnapshot();
    return {
      terminalId,
      processKind: entry.processKind,
      command: [...entry.command],
      cwd: entry.cwd,
      workspace: entry.terminal.getWorkspace(),
      running: entry.terminal.isRunning(),
      status: entry.terminal.getStatus(),
      seq: snapshot.seq,
      focused: this.focusedTerminalIds.has(terminalId),
      icon: entry.profile.icon,
      title: entry.profile.title,
      shortcuts: cloneShortcuts(entry.profile.shortcuts),
      transportUrl: this.getTransportEndpoint(terminalId)?.url,
    };
  }
}
