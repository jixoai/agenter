import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { isPrincipalId } from "@agenter/principal-crypto";
import { ManagedTerminal, type ManagedTerminalConfig, type ManagedTerminalSnapshot } from "./managed-terminal";
import type {
  TerminalAccessProjection,
  TerminalActorId,
  TerminalAdminCandidateRecord,
  TerminalApprovalRequestRecord,
  TerminalControlPlaneConfig,
  TerminalControlPlaneConfigPatch,
  TerminalControlPlaneEntry,
  TerminalCreateInput,
  TerminalEventRecord,
  TerminalFocusOp,
  TerminalGrantRecord,
  TerminalGrantRole,
  TerminalIssueGrantInput,
  TerminalIssuedGrant,
  TerminalPatchInput,
  TerminalProcessProfile,
  TerminalReadMode,
  TerminalReadProjection,
  TerminalReadResult,
  TerminalRecord,
  TerminalReverseCursor,
  TerminalReversePage,
  TerminalSeatProjection,
  TerminalShortcutMap,
  TerminalTransportClientMessage,
  TerminalTransportConfig,
  TerminalTransportEndpoint,
  TerminalTransportServerMessage,
  TerminalWriteInput,
  TerminalWriteLeaseRecord,
  TerminalWriteResult,
} from "./terminal-control-plane.types";
import { TerminalDb } from "./terminal-db";
import type { TerminalStatus } from "./types";

interface ManagedEntry {
  record: TerminalRecord;
  terminal: ManagedTerminal;
}

interface ActorPresence {
  online: boolean;
  expiresAt: number | null;
  invalidCredential: boolean;
}

interface TerminalTransportSocketData {
  cleanup: Array<() => void>;
  terminalId: string;
  actorId: TerminalActorId | null;
  accessRole: TerminalGrantRole;
  accessToken: string;
}

type TerminalChangeReason =
  | "created"
  | "updated"
  | "deleted"
  | "activity"
  | "grant-issued"
  | "grant-revoked"
  | "focus"
  | "presence"
  | "approval"
  | "snapshot"
  | "status";

interface TerminalChangePayload {
  terminalId: string;
  reason: TerminalChangeReason;
  actorId?: TerminalActorId;
}

const TRUSTED_BOOTSTRAP_LABEL = "Trusted terminal bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID = "system:trusted-terminal-bootstrap" as const satisfies TerminalActorId;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const LEGACY_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const DEFAULT_APPROVAL_TIMEOUT_MS = 90_000;
const TRANSIENT_ACTOR_PRESENCE_TTL_MS = 90_000;

const createId = (): string => `term-${randomUUID()}`;
const defaultShellCommand = (): string[] => [process.env.SHELL || "/bin/bash"];
const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
const createOpaqueToken = (): string => `termtok_${randomUUID().replace(/-/g, "")}`;
const isCanonicalActorId = (actorId: string): actorId is TerminalActorId =>
  isPrincipalId(actorId) || LEGACY_ACTOR_ID_PATTERN.test(actorId);

const roleRank = (role: TerminalGrantRole): number => {
  switch (role) {
    case "admin":
      return 3;
    case "writer":
      return 2;
    case "requester":
      return 1;
    default:
      return 0;
  }
};

const cloneShortcuts = (input?: TerminalShortcutMap): TerminalShortcutMap | undefined =>
  input ? { ...input } : undefined;

const cloneProfile = (input?: TerminalProcessProfile): TerminalProcessProfile => ({
  command: input?.command ? [...input.command] : undefined,
  cwd: input?.cwd,
  env: input?.env ? { ...input.env } : undefined,
  cols: input?.cols,
  rows: input?.rows,
  gitLog: input?.gitLog,
  logStyle: input?.logStyle,
  icon: input?.icon,
  title: input?.title,
  shortcuts: cloneShortcuts(input?.shortcuts),
  rendererEngine: input?.rendererEngine,
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
    if (profile.env) {
      merged.env = { ...(merged.env ?? {}), ...profile.env };
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
    if (profile.rendererEngine !== undefined) {
      merged.rendererEngine = profile.rendererEngine;
    }
  }
  return merged;
};

const buildSnapshotPayload = (
  terminalId: string,
  snapshot: ManagedTerminalSnapshot,
  projection: TerminalReadProjection,
): TerminalReadResult => ({
  kind: "terminal-snapshot",
  representation: "snapshot",
  terminalId,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  tail: snapshot.lines.slice(-20).join("\n"),
  snapshot,
  status: projection.status,
  title: projection.title,
  running: projection.running,
});

const buildDiffPayload = (
  terminalId: string,
  input: {
    fromHash: string | null;
    toHash: string | null;
    diff: string;
    bytes: number;
  },
  projection: TerminalReadProjection,
): TerminalReadResult => ({
  kind: "terminal-diff",
  representation: "diff",
  terminalId,
  fromHash: input.fromHash,
  toHash: input.toHash,
  diff: input.diff,
  bytes: input.bytes,
  status: projection.status,
  title: projection.title,
  running: projection.running,
});

const toManagedGitLogMode = (value: TerminalProcessProfile["gitLog"]): false | "normal" | "verbose" => {
  if (value === "normal" || value === "verbose") {
    return value;
  }
  return false;
};

const toTransportPath = (pathPrefix: string, terminalId: string): string =>
  `${pathPrefix.replace(/\/$/, "")}/${encodeURIComponent(terminalId)}`;

const appendTokenToUrl = (url: string, accessToken?: string): string => {
  if (!accessToken) {
    return url;
  }
  const next = new URL(url);
  next.searchParams.set("token", accessToken);
  return next.toString();
};

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
  private readonly db: TerminalDb;
  private readonly entries = new Map<string, ManagedEntry>();
  private readonly focusedTerminalIdsByActor = new Map<string, Set<string>>();
  private readonly actorPresence = new Map<string, ActorPresence>();
  private readonly changeListeners = new Set<(payload: TerminalChangePayload) => void>();
  private readonly snapshotListeners = new Set<
    (payload: { terminalId: string; snapshot: ManagedTerminalSnapshot }) => void
  >();
  private readonly statusListeners = new Set<
    (payload: { terminalId: string; running: boolean; status: TerminalStatus }) => void
  >();
  private readonly focusListeners = new Set<
    (payload: { actorId: TerminalActorId; terminalIds: string[]; terminalId: string | null }) => void
  >();
  private readonly approvalRequestListeners = new Set<
    (payload: { terminalId: string; request: TerminalApprovalRequestRecord }) => void
  >();
  private config: TerminalControlPlaneConfig;
  private transportServer: Bun.Server<TerminalTransportSocketData> | null = null;

  constructor(
    private readonly options: {
      dbPath?: string;
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
      approvalTimeoutMs: options.initialConfig?.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
    };
    this.db = new TerminalDb(options.dbPath ?? join(homedir(), ".agenter", ".terminal", "terminal.db"));
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

  onFocus(
    listener: (payload: { actorId: TerminalActorId; terminalIds: string[]; terminalId: string | null }) => void,
  ): () => void {
    this.focusListeners.add(listener);
    return () => {
      this.focusListeners.delete(listener);
    };
  }

  onApprovalRequest(
    listener: (payload: { terminalId: string; request: TerminalApprovalRequestRecord }) => void,
  ): () => void {
    this.approvalRequestListeners.add(listener);
    return () => {
      this.approvalRequestListeners.delete(listener);
    };
  }

  onChanged(listener: (payload: TerminalChangePayload) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  setActorPresence(actorId: TerminalActorId, input: { online: boolean; ttlMs?: number } | boolean): void {
    this.assertActorId(actorId);
    const online = typeof input === "boolean" ? input : input.online;
    const current = this.actorPresence.get(actorId);
    if (!online) {
      this.actorPresence.delete(actorId);
      this.syncAdminAssignments();
      if (current) {
        this.emitPresenceChanged(actorId);
      }
      return;
    }
    const ttlMs = typeof input === "boolean" ? undefined : input.ttlMs;
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt:
        typeof ttlMs === "number" && ttlMs > 0
          ? Date.now() + ttlMs
          : actorId.startsWith("auth:")
            ? Date.now() + TRANSIENT_ACTOR_PRESENCE_TTL_MS
            : (current?.expiresAt ?? null),
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.syncAdminAssignments();
    if (!current?.online) {
      this.emitPresenceChanged(actorId);
    }
  }

  setCredentialState(actorId: TerminalActorId, input: { invalidCredential: boolean }): void {
    this.assertActorId(actorId);
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: current?.online ?? false,
      expiresAt: current?.expiresAt ?? null,
      invalidCredential: input.invalidCredential,
    });
    if ((current?.invalidCredential ?? false) !== input.invalidCredential) {
      this.emitPresenceChanged(actorId);
    }
  }

  has(terminalId: string): boolean {
    return Boolean(this.db.getTerminal(terminalId));
  }

  getManagedTerminal(terminalId: string): ManagedTerminal | null {
    return this.entries.get(terminalId)?.terminal ?? null;
  }

  list(): TerminalControlPlaneEntry[] {
    this.expireApprovalsAndLeases();
    return this.db.listTerminals().map((record) =>
      this.describeEntry(record, {
        focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(record.terminalId),
        access: this.getTrustedBootstrapAccess(record.terminalId),
      }),
    );
  }

  listForActor(actorId: TerminalActorId, input: { touchPresence?: boolean } = {}): TerminalControlPlaneEntry[] {
    this.assertActorId(actorId);
    if (input.touchPresence ?? true) {
      this.touchActorPresence(actorId);
    }
    this.expireApprovalsAndLeases();
    const focused = new Set(this.getFocusedTerminalIds(actorId));
    return this.db
      .listTerminals()
      .map((record) => {
        const grant = this.getGrantForActor(record.terminalId, actorId);
        if (!grant) {
          return null;
        }
        return this.describeEntry(record, {
          focused: focused.has(record.terminalId),
          access: this.createAccessProjection(record.terminalId, grant),
        });
      })
      .filter((entry): entry is TerminalControlPlaneEntry => entry !== null);
  }

  async create(input: TerminalCreateInput = {}): Promise<TerminalControlPlaneEntry> {
    const bootstrapActorId = input.bootstrapActorId ?? TRUSTED_BOOTSTRAP_PARTICIPANT_ID;
    const bootstrapRole = input.bootstrapRole ?? "admin";
    const created = this.createRecord(input);
    const access = this.ensureActorAccess(
      created.terminalId,
      bootstrapActorId,
      bootstrapRole,
      input.bootstrapAccessToken,
    );
    const adminGroup = input.adminGroupCandidateIds ?? [bootstrapActorId];
    this.db.setAdminGroup(created.terminalId, adminGroup);
    this.syncAdminAssignments(created.terminalId);
    if (input.start !== false) {
      this.start(created.terminalId);
    }
    this.emitChange({
      terminalId: created.terminalId,
      reason: "created",
      actorId: bootstrapActorId,
    });
    return this.describeEntry(this.requireRecord(created.terminalId), {
      focused: false,
      access,
    });
  }

  async createForActor(
    actorId: TerminalActorId,
    input: Omit<TerminalCreateInput, "bootstrapActorId" | "bootstrapRole" | "bootstrapAccessToken"> & {
      role?: TerminalGrantRole;
      accessTokenHint?: string;
    } = {},
  ): Promise<TerminalControlPlaneEntry> {
    return await this.create({
      ...input,
      bootstrapActorId: actorId,
      bootstrapRole: input.role ?? "admin",
      bootstrapAccessToken: input.accessTokenHint,
      adminGroupCandidateIds: input.adminGroupCandidateIds ?? [actorId],
    });
  }

  start(terminalId: string): TerminalControlPlaneEntry {
    const entry = this.ensureManagedEntry(terminalId);
    if (!entry.terminal.isRunning()) {
      entry.terminal.start();
    }
    return this.describeEntry(entry.record, {
      focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(terminalId),
      access: this.getTrustedBootstrapAccess(terminalId),
    });
  }

  async kill(terminalId: string): Promise<{ ok: boolean; message: string }> {
    const entry = this.entries.get(terminalId);
    if (entry) {
      await entry.terminal.stop();
      this.entries.delete(terminalId);
    }
    const existed = this.db.removeTerminal(terminalId);
    if (!existed) {
      return { ok: false, message: `unknown terminal: ${terminalId}` };
    }
    for (const [actorId, focused] of this.focusedTerminalIdsByActor.entries()) {
      if (!focused.delete(terminalId)) {
        continue;
      }
      this.emitFocus(actorId as TerminalActorId);
    }
    this.emitChange({ terminalId, reason: "deleted" });
    return { ok: true, message: "terminal stopped" };
  }

  async killAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return await this.kill(input.terminalId);
  }

  focus(op: TerminalFocusOp = "replace", terminalIds: string[] = []): string[] {
    return this.focusForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID, op, terminalIds);
  }

  focusForActor(actorId: TerminalActorId, op: TerminalFocusOp = "replace", terminalIds: string[] = []): string[] {
    this.assertActorId(actorId);
    const validIds = terminalIds.filter((terminalId) =>
      actorId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID
        ? this.has(terminalId)
        : Boolean(this.getGrantForActor(terminalId, actorId)),
    );
    const previous = new Set(this.getFocusedTerminalIds(actorId));
    const current = new Set(previous);
    switch (op) {
      case "add":
        for (const terminalId of validIds) {
          current.add(terminalId);
        }
        break;
      case "remove":
        for (const terminalId of validIds) {
          current.delete(terminalId);
        }
        break;
      case "replace":
        current.clear();
        for (const terminalId of validIds) {
          current.add(terminalId);
        }
        break;
      case "clear":
        current.clear();
        break;
    }
    this.focusedTerminalIdsByActor.set(actorId, current);
    this.emitFocus(actorId);
    for (const terminalId of new Set([...previous, ...current])) {
      if (previous.has(terminalId) === current.has(terminalId)) {
        continue;
      }
      this.emitChange({ terminalId, reason: "focus", actorId });
    }
    return [...current];
  }

  focusAuthorized(op: TerminalFocusOp, access: Array<{ terminalId: string; accessToken: string }>): string[] {
    const grants = access.map(({ terminalId, accessToken }) => this.requireAccess(terminalId, accessToken, "readonly"));
    const actorId = grants[0]?.participantId;
    if (!actorId || !isCanonicalActorId(actorId)) {
      return this.focus(
        op,
        grants.map((grant) => grant.terminalId),
      );
    }
    const allowedTerminalIds = grants
      .map((grant) => grant.terminalId)
      .filter((terminalId, index, items) => items.indexOf(terminalId) === index);
    return this.focusForActor(actorId as TerminalActorId, op, allowedTerminalIds);
  }

  getFocusedTerminalIds(actorId: TerminalActorId = TRUSTED_BOOTSTRAP_PARTICIPANT_ID): string[] {
    let focused = this.focusedTerminalIdsByActor.get(actorId);
    if (!focused) {
      focused = new Set<string>();
      this.focusedTerminalIdsByActor.set(actorId, focused);
    }
    return [...focused];
  }

  getTransportEndpoint(terminalId: string, accessToken?: string): TerminalTransportEndpoint | null {
    const transport = this.getConfig().transport;
    const livePort = this.transportServer ? Number.parseInt(this.transportServer.url.port, 10) : Number.NaN;
    const port = Number.isFinite(livePort) && livePort > 0 ? livePort : transport?.port;
    if (!port) {
      return null;
    }
    const resolvedAccessToken = accessToken ?? this.getTrustedBootstrapAccess(terminalId)?.accessToken;
    if (!resolvedAccessToken) {
      return null;
    }
    const host = transport.host ?? this.transportServer?.url.hostname ?? "127.0.0.1";
    const path = toTransportPath(transport.pathPrefix ?? "/pty", terminalId);
    const baseUrl = `ws://${host}:${port}${path}`;
    return {
      host,
      port,
      path,
      url: appendTokenToUrl(baseUrl, resolvedAccessToken),
    };
  }

  async startTransport(
    input: { host?: string; port?: number; pathPrefix?: string } = {},
  ): Promise<TerminalTransportConfig> {
    if (this.transportServer) {
      return cloneTransportConfig(this.config.transport);
    }

    const host = input.host ?? this.config.transport?.host ?? "127.0.0.1";
    const pathPrefix = input.pathPrefix ?? this.config.transport?.pathPrefix ?? "/pty";
    const requestedPort = input.port ?? this.config.transport?.port ?? 0;
    const normalizedPrefix = pathPrefix.replace(/\/$/, "");

    this.transportServer = Bun.serve<TerminalTransportSocketData>({
      hostname: host,
      port: requestedPort,
      fetch: (request, serverInstance) => {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(`${normalizedPrefix}/`)) {
          return new Response("not found", { status: 404 });
        }
        const terminalId = decodeURIComponent(url.pathname.slice(normalizedPrefix.length + 1));
        const accessToken = url.searchParams.get("token");
        if (!accessToken) {
          return new Response("missing token", { status: 401 });
        }
        let grant: TerminalGrantRecord;
        try {
          grant = this.requireAccess(terminalId, accessToken, "readonly");
        } catch {
          return new Response("credential-invalid", { status: 401 });
        }
        const upgraded = serverInstance.upgrade(request, {
          data: {
            cleanup: [],
            terminalId,
            actorId: grant.participantId ?? null,
            accessRole: grant.role,
            accessToken,
          },
        });
        return upgraded ? undefined : new Response("upgrade failed", { status: 500 });
      },
      websocket: {
        open: (socket) => {
          const record = this.db.getTerminal(socket.data.terminalId);
          if (!record) {
            socket.close(4404, "terminal-not-found");
            return;
          }
          const entry = this.ensureManagedEntry(record.terminalId);
          const cleanup: Array<() => void> = [];
          cleanup.push(
            entry.terminal.onSnapshot((snapshot) => {
              socket.send(
                JSON.stringify({
                  type: "snapshot",
                  terminalId: record.terminalId,
                  snapshot,
                  status: entry.terminal.getStatus(),
                } satisfies TerminalTransportServerMessage),
              );
            }),
          );
          cleanup.push(
            entry.terminal.onOutput((data) => {
              socket.send(
                JSON.stringify({
                  type: "output",
                  terminalId: record.terminalId,
                  data,
                } satisfies TerminalTransportServerMessage),
              );
            }),
          );
          cleanup.push(
            entry.terminal.onStatus((running, status) => {
              socket.send(
                JSON.stringify({
                  type: "status",
                  terminalId: record.terminalId,
                  running,
                  status,
                } satisfies TerminalTransportServerMessage),
              );
              if (!running) {
                socket.close(1000, "terminal-stopped");
              }
            }),
          );
          socket.data.cleanup = cleanup;
          if (!entry.terminal.isRunning()) {
            entry.terminal.start();
          }
          socket.send(
            JSON.stringify({
              type: "snapshot",
              terminalId: record.terminalId,
              snapshot: entry.terminal.getSnapshot(),
              status: entry.terminal.getStatus(),
            } satisfies TerminalTransportServerMessage),
          );
        },
        message: async (socket, message) => {
          const terminalId = socket.data.terminalId;
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
          try {
            if (parsed.type === "input") {
              const result = await this.write({
                terminalId,
                text: parsed.data,
                submit: false,
                accessToken: socket.data.accessToken,
                actorId: socket.data.actorId ?? undefined,
              });
              if (!result.ok) {
                throw new Error(result.message);
              }
              return;
            }
            this.ensureManagedEntry(terminalId).terminal.resize(parsed.cols, parsed.rows);
          } catch (error) {
            socket.send(
              JSON.stringify({
                type: "error",
                terminalId,
                message: error instanceof Error ? error.message : "terminal access denied",
              } satisfies TerminalTransportServerMessage),
            );
          }
        },
        close: (socket) => {
          for (const cleanup of socket.data.cleanup) {
            cleanup();
          }
          socket.data.cleanup = [];
        },
      },
    });

    const livePort = Number.parseInt(this.transportServer.url.port, 10);
    this.config = {
      ...this.config,
      transport: {
        host,
        pathPrefix,
        port:
          Number.isFinite(livePort) && livePort > 0 ? livePort : (this.transportServer.port ?? requestedPort ?? null),
      },
    };
    return cloneTransportConfig(this.config.transport);
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
    options: { remark?: boolean; recordActivity?: boolean } = {},
  ): Promise<TerminalReadResult> {
    return await this.readAuthorized({
      terminalId,
      mode,
      remark: options.remark ?? false,
      recordActivity: options.recordActivity ?? true,
    });
  }

  async readAuthorized(input: {
    terminalId: string;
    mode?: TerminalReadMode;
    remark?: boolean;
    recordActivity?: boolean;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): Promise<TerminalReadResult> {
    this.authorizeRead(input);
    const actorId = this.resolveEventActorId(input);
    const entry = this.ensureManagedEntry(input.terminalId);
    const mode = input.mode ?? "auto";
    const snapshot = await entry.terminal.read();
    const projection = this.describeReadProjection(entry.record, entry.terminal);
    const snapshotPayload = buildSnapshotPayload(input.terminalId, snapshot, projection);
    if (entry.record.profile.gitLog && mode !== "snapshot") {
      const diff = await entry.terminal.sliceDirty({ remark: input.remark ?? false, wait: false });
      if (diff.ok && diff.changed && diff.fromHash !== diff.toHash) {
        const diffPayload = buildDiffPayload(
          input.terminalId,
          {
            fromHash: diff.fromHash,
            toHash: diff.toHash,
            diff: diff.diff,
            bytes: diff.bytes,
          },
          projection,
        );
        const shouldUseDiff =
          mode === "diff" || JSON.stringify(diffPayload).length <= JSON.stringify(snapshotPayload).length;
        if (shouldUseDiff) {
          return this.finalizeReadResult(diffPayload, actorId, input.recordActivity ?? true);
        }
      }
    }
    return this.finalizeReadResult(snapshotPayload, actorId, input.recordActivity ?? true);
  }

  async snapshot(
    terminalId: string,
    options: { remark?: boolean; recordActivity?: boolean } = {},
  ): Promise<TerminalReadResult> {
    return await this.read(terminalId, "snapshot", options);
  }

  async write(input: TerminalWriteInput): Promise<TerminalWriteResult> {
    const entry = this.ensureManagedEntry(input.terminalId);
    if (!entry.terminal.isRunning()) {
      entry.terminal.start();
    }
    const decision = this.authorizeWrite({
      terminalId: input.terminalId,
      actorId: input.actorId,
      accessToken: input.accessToken,
      superadminActorId: input.superadminActorId,
    });
    if (!decision.ok) {
      const message = decision.message ?? "terminal write denied";
      const approvalActorId = input.actorId ?? decision.grant?.participantId;
      if (
        input.createApprovalRequest === false ||
        !approvalActorId ||
        !decision.grant ||
        decision.grant.role !== "requester"
      ) {
        return { ok: false, message };
      }
      const request = this.createApprovalRequest({
        terminalId: input.terminalId,
        actorId: approvalActorId,
        requestedInput: {
          text: input.text,
          submit: input.submit,
          submitKey: input.submitKey,
        },
      });
      return { ok: false, message, approvalRequest: request };
    }

    await entry.terminal.write(input.text, input.submit ?? true, input.submitKey ?? "enter", input.submitGapMs ?? 80);
    const writeEvent = this.db.appendEvent({
      terminalId: input.terminalId,
      kind: "terminal_write",
      payload: {
        title: input.submit || input.submitKey ? "Terminal write + submit" : "Terminal write",
        content: input.text,
        actorId: this.resolveEventActorId(input),
        detail: {
          submit: input.submit,
          submitKey: input.submitKey ?? null,
        },
      },
    });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "activity",
      actorId: this.resolveEventActorId(input),
    });
    if (!input.returnRead) {
      return { ok: true, message: "written", eventId: writeEvent.eventId };
    }
    if (typeof input.returnRead === "object") {
      const waitMs = Math.max(input.returnRead.throttleMs ?? 0, input.returnRead.debounceMs ?? 0);
      if (waitMs > 0) {
        await Bun.sleep(waitMs);
      }
    }
    const read = await this.readAuthorized({
      terminalId: input.terminalId,
      mode: input.readMode ?? "auto",
      recordActivity: input.readRecordActivity ?? false,
      actorId: input.actorId,
      accessToken: input.accessToken,
      superadminActorId: input.superadminActorId,
    });
    return { ok: true, message: "written", eventId: writeEvent.eventId, read };
  }

  getEvent(eventId: number): TerminalEventRecord | undefined {
    return this.db.getEvent(eventId);
  }

  pageEvents(
    terminalId: string,
    input?: { before?: TerminalReverseCursor; limit?: number },
  ): TerminalReversePage<TerminalEventRecord> {
    this.authorizeRead({ terminalId });
    this.requireRecord(terminalId);
    return this.db.listEventsPage(terminalId, input);
  }

  pageEventsAuthorized(input: {
    terminalId: string;
    before?: TerminalReverseCursor;
    limit?: number;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): TerminalReversePage<TerminalEventRecord> {
    this.authorizeRead(input);
    this.requireRecord(input.terminalId);
    return this.db.listEventsPage(input.terminalId, {
      before: input.before,
      limit: input.limit,
    });
  }

  waitCommitted(
    terminalId: string,
    input: { fromHash?: string | null } = {},
  ): { promise: Promise<{ toHash: string | null }>; reject: (reason: unknown) => void } {
    return this.ensureManagedEntry(terminalId).terminal.waitCommitted(input);
  }

  getHeadHash(terminalId: string): string | null {
    return this.ensureManagedEntry(terminalId).terminal.getHeadHash();
  }

  async markDirty(terminalId: string): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    return await this.ensureManagedEntry(terminalId).terminal.markDirty();
  }

  getSnapshot(terminalId: string): ManagedTerminalSnapshot {
    return this.ensureManagedEntry(terminalId).terminal.getSnapshot();
  }

  getStatus(terminalId: string): TerminalStatus {
    const entry = this.entries.get(terminalId);
    return entry?.terminal.getStatus() ?? "IDLE";
  }

  isRunning(terminalId: string): boolean {
    return this.entries.get(terminalId)?.terminal.isRunning() ?? false;
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
      approvalTimeoutMs: this.config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
    };
  }

  setConfig(patch: TerminalControlPlaneConfigPatch): TerminalControlPlaneConfig {
    this.config = {
      defaults: patch.defaults
        ? mergeProfile(this.config.defaults, patch.defaults)
        : cloneProfile(this.config.defaults),
      processProfiles: {
        ...(this.config.processProfiles ?? {}),
        ...Object.fromEntries(
          Object.entries(patch.processProfiles ?? {}).map(([key, value]) => [
            key,
            mergeProfile(this.config.processProfiles?.[key], value),
          ]),
        ),
      },
      terminalProfiles: {
        ...(this.config.terminalProfiles ?? {}),
        ...Object.fromEntries(
          Object.entries(patch.terminalProfiles ?? {}).map(([key, value]) => [
            key,
            mergeProfile(this.config.terminalProfiles?.[key], value),
          ]),
        ),
      },
      transport: {
        ...(this.config.transport ?? cloneTransportConfig()),
        ...(patch.transport ?? {}),
        port: patch.transport?.port ?? this.config.transport?.port ?? null,
      },
      approvalTimeoutMs: patch.approvalTimeoutMs ?? this.config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
    };
    return this.getConfig();
  }

  updateTerminalAuthorized(
    input: {
      terminalId: string;
      accessToken?: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } & TerminalPatchInput,
  ): TerminalControlPlaneEntry {
    this.requireAdministrativeAuthority(input.terminalId, {
      accessToken: input.accessToken,
      actorId: input.actorId,
      superadminActorId: input.superadminActorId,
    });
    if (input.adminGroupCandidateIds) {
      input.adminGroupCandidateIds.forEach((actorId) => {
        if (!this.getGrantForActor(input.terminalId, actorId)) {
          throw new Error(`admin candidate requires an active terminal grant: ${actorId}`);
        }
      });
      this.db.setAdminGroup(input.terminalId, input.adminGroupCandidateIds);
      this.syncAdminAssignments(input.terminalId);
    }
    const record = this.db.updateTerminal(input.terminalId, input);
    const managed = this.entries.get(input.terminalId);
    if (managed) {
      managed.record = record;
    }
    this.emitChange({ terminalId: input.terminalId, reason: "updated", actorId: input.actorId });
    return this.describeEntry(record, {
      focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(input.terminalId),
      access: input.actorId
        ? this.createAccessProjection(input.terminalId, this.requireGrantForActor(input.terminalId, input.actorId))
        : this.getTrustedBootstrapAccess(input.terminalId),
    });
  }

  listGrantsAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalGrantRecord[] {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return this.db.listActiveGrants(input.terminalId).filter((grant) => !this.isTrustedBootstrapGrant(grant));
  }

  issueGrantAuthorized(
    input: {
      terminalId: string;
      accessToken?: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } & TerminalIssueGrantInput,
  ): TerminalIssuedGrant {
    this.requireAdministrativeAuthority(input.terminalId, input);
    const access = this.ensureActorAccess(
      input.terminalId,
      input.participantId,
      input.role,
      input.accessTokenHint,
      input.label,
    );
    if (input.adminCandidateRank === null) {
      const nextCandidates = this.db
        .listAdminCandidates(input.terminalId)
        .filter((candidate) => candidate.participantId !== input.participantId)
        .map((candidate) => candidate.participantId);
      this.db.setAdminGroup(input.terminalId, nextCandidates);
    } else if (typeof input.adminCandidateRank === "number" && Number.isFinite(input.adminCandidateRank)) {
      const candidates = this.mergeAdminCandidate(input.terminalId, input.participantId, input.adminCandidateRank);
      this.db.setAdminGroup(
        input.terminalId,
        candidates.sort((left, right) => left.priority - right.priority).map((candidate) => candidate.participantId),
      );
    }
    this.syncAdminAssignments(input.terminalId);
    const grant = this.requireGrantForActor(input.terminalId, input.participantId);
    const currentAdminId = this.resolveCurrentAdminActorId(input.terminalId);
    const adminCandidateRank = this.readAdminCandidateRank(input.terminalId, input.participantId);
    this.emitChange({
      terminalId: input.terminalId,
      reason: "grant-issued",
      actorId: input.participantId,
    });
    return {
      ...grant,
      accessToken: access.accessToken,
      currentAdmin: currentAdminId === input.participantId,
      adminCandidateRank,
    };
  }

  revokeGrantAuthorized(input: {
    terminalId: string;
    grantId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { ok: boolean } {
    this.requireAdministrativeAuthority(input.terminalId, input);
    const grant = this.db.getGrantById(input.terminalId, input.grantId);
    if (!grant) {
      return { ok: false };
    }
    const ok = this.db.revokeGrant(input.terminalId, input.grantId);
    if (grant.participantId) {
      const candidates = this.db
        .listAdminCandidates(input.terminalId)
        .filter((candidate) => candidate.participantId !== grant.participantId)
        .map((candidate) => candidate.participantId);
      this.db.setAdminGroup(input.terminalId, candidates);
      this.syncAdminAssignments(input.terminalId);
    }
    this.emitChange({
      terminalId: input.terminalId,
      reason: "grant-revoked",
      actorId: grant.participantId,
    });
    return { ok };
  }

  listApprovalRequests(
    input: {
      terminalId?: string;
      assignedAdminId?: TerminalActorId;
      participantId?: TerminalActorId;
      statuses?: Array<TerminalApprovalRequestRecord["status"]>;
    } = {},
  ): TerminalApprovalRequestRecord[] {
    this.expireApprovalsAndLeases();
    const terminalIds = input.terminalId
      ? [input.terminalId]
      : this.db.listTerminals().map((record) => record.terminalId);
    return terminalIds.flatMap((terminalId) =>
      this.db.listApprovalRequests(terminalId, {
        assignedAdminId: input.assignedAdminId,
        participantId: input.participantId,
        statuses: input.statuses,
      }),
    );
  }

  listApprovalRequestsAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
    assignedAdminId?: TerminalActorId;
    participantId?: TerminalActorId;
    statuses?: Array<TerminalApprovalRequestRecord["status"]>;
  }): TerminalApprovalRequestRecord[] {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return this.listApprovalRequests({
      terminalId: input.terminalId,
      assignedAdminId: input.assignedAdminId,
      participantId: input.participantId,
      statuses: input.statuses,
    });
  }

  approveRequestAuthorized(input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalWriteLeaseRecord {
    const actorId = this.requireAdministrativeAuthority(input.terminalId, input);
    const request = this.requirePendingApprovalRequest(input.terminalId, input.requestId);
    const expiresAt = Date.now() + Math.max(1_000, input.durationMs);
    const lease = this.db.createWriteLease({
      terminalId: input.terminalId,
      participantId: request.participantId,
      grantedBy: actorId ?? input.superadminActorId,
      requestId: request.requestId,
      expiresAt,
    });
    const updated = this.db.updateApprovalRequest(input.terminalId, input.requestId, {
      status: "approved",
      decidedAt: Date.now(),
      decidedBy: actorId ?? input.superadminActorId ?? null,
      leaseId: lease.leaseId,
    });
    this.emitApprovalRequest({ terminalId: input.terminalId, request: updated });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "approval",
      actorId: request.participantId,
    });
    return lease;
  }

  denyRequestAuthorized(input: {
    terminalId: string;
    requestId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalApprovalRequestRecord {
    const actorId = this.requireAdministrativeAuthority(input.terminalId, input);
    const request = this.requirePendingApprovalRequest(input.terminalId, input.requestId);
    const updated = this.db.updateApprovalRequest(input.terminalId, input.requestId, {
      status: "denied",
      decidedAt: Date.now(),
      decidedBy: actorId ?? input.superadminActorId ?? null,
    });
    this.emitApprovalRequest({ terminalId: input.terminalId, request: updated });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "approval",
      actorId: request.participantId,
    });
    return updated;
  }

  async dispose(): Promise<void> {
    this.stopTransport();
    for (const entry of this.entries.values()) {
      await entry.terminal.stop();
    }
    this.entries.clear();
    this.db.close();
  }

  private createRecord(input: TerminalCreateInput): TerminalRecord {
    const terminalId = input.terminalId ?? createId();
    if (this.db.getTerminal(terminalId)) {
      throw new Error(`terminal already exists: ${terminalId}`);
    }
    const processKind = input.processKind ?? "shell";
    const profile = mergeProfile(
      this.config.defaults,
      this.config.processProfiles?.[processKind],
      input.terminalId ? this.config.terminalProfiles?.[input.terminalId] : undefined,
      input.profile,
      { command: input.command, cwd: input.cwd },
    );
    const command = profile.command
      ? [...profile.command]
      : [...(this.options.defaultShellCommand ?? defaultShellCommand())];
    const cwd = resolve(profile.cwd ?? homedir());
    return this.db.createTerminal({
      terminalId,
      processKind,
      command,
      cwd,
      profile,
      metadata: {},
    });
  }

  private ensureManagedEntry(terminalId: string): ManagedEntry {
    const existing = this.entries.get(terminalId);
    if (existing) {
      return existing;
    }
    const record = this.requireRecord(terminalId);
    const normalizedCwd = resolve(record.cwd);
    const managedConfig: ManagedTerminalConfig = {
      terminalId: record.terminalId,
      command: [...record.command],
      cwd: normalizedCwd,
      env: record.profile.env,
      cols: record.profile.cols ?? 120,
      rows: record.profile.rows ?? 30,
      gitLog: toManagedGitLogMode(record.profile.gitLog),
      logStyle: record.profile.logStyle ?? "rich",
      outputRoot: join(
        this.options.outputRoot ?? join(homedir(), ".agenter", ".terminal", "output"),
        record.terminalId,
      ),
    };
    const terminal = new ManagedTerminal(managedConfig);
    const next: ManagedEntry = { record, terminal };
    this.bindTerminalListeners(next);
    this.entries.set(terminalId, next);
    return next;
  }

  private bindTerminalListeners(entry: ManagedEntry): void {
    entry.terminal.onSnapshot((snapshot) => {
      this.emitSnapshot({ terminalId: entry.record.terminalId, snapshot });
      this.emitChange({ terminalId: entry.record.terminalId, reason: "snapshot" });
    });
    entry.terminal.onStatus((running, status) => {
      this.emitStatus({ terminalId: entry.record.terminalId, running, status });
      this.emitChange({ terminalId: entry.record.terminalId, reason: "status" });
    });
  }

  private describeEntry(
    record: TerminalRecord,
    input: { focused: boolean; access?: TerminalAccessProjection | null },
  ): TerminalControlPlaneEntry {
    const entry = this.entries.get(record.terminalId);
    const snapshot = entry?.terminal.getSnapshot();
    const access = input.access ?? undefined;
    const normalizedCwd = resolve(record.cwd);
    return {
      terminalId: record.terminalId,
      processKind: record.processKind,
      command: [...record.command],
      cwd: normalizedCwd,
      workspace: entry?.terminal.getWorkspace() ?? null,
      running: entry?.terminal.isRunning() ?? false,
      status: entry?.terminal.getStatus() ?? "IDLE",
      seq: snapshot?.seq ?? 0,
      snapshot,
      focused: input.focused,
      icon: record.profile.icon,
      title: record.profile.title,
      shortcuts: cloneShortcuts(record.profile.shortcuts),
      rendererEngine: record.profile.rendererEngine ?? "xterm",
      transportUrl: access?.accessToken
        ? this.getTransportEndpoint(record.terminalId, access.accessToken)?.url
        : undefined,
      currentAdminId: this.resolveCurrentAdminActorId(record.terminalId),
      approvalTimeoutMs: this.config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
      pendingRequestCount: this.db.listPendingApprovalRequests(record.terminalId).length,
      access: access ?? undefined,
      actors: this.listActorSeats(record.terminalId),
    };
  }

  private listActorSeats(terminalId: string): TerminalSeatProjection[] {
    const currentAdminId = this.resolveCurrentAdminActorId(terminalId);
    const activeLeaseByActor = new Map<string, TerminalWriteLeaseRecord>();
    const actorToGrant = new Map<string, TerminalGrantRecord>();
    for (const grant of this.db.listActiveGrants(terminalId)) {
      if (!grant.participantId || this.isTrustedBootstrapGrant(grant)) {
        continue;
      }
      actorToGrant.set(grant.participantId, grant);
    }
    for (const actorId of actorToGrant.keys()) {
      const lease = this.db.findActiveLease(terminalId, actorId);
      if (lease) {
        activeLeaseByActor.set(actorId, lease);
      }
    }
    const adminCandidates = this.db.listAdminCandidates(terminalId);
    const candidateRanks = new Map(adminCandidates.map((candidate) => [candidate.participantId, candidate.priority]));
    const focusedByActor = new Map<string, boolean>();
    for (const [actorId, focusedIds] of this.focusedTerminalIdsByActor.entries()) {
      if (focusedIds.has(terminalId)) {
        focusedByActor.set(actorId, true);
      }
    }
    const entries = [...actorToGrant.values()].map((grant) => {
      const actorId = grant.participantId!;
      const presence = this.actorPresence.get(actorId);
      const lease = activeLeaseByActor.get(actorId);
      return {
        actorId,
        role: grant.role,
        label: grant.label,
        currentAdmin: currentAdminId === actorId,
        adminCandidateRank: candidateRanks.get(actorId),
        online: presence?.online ?? false,
        focused: focusedByActor.get(actorId) ?? false,
        invalidCredential: presence?.invalidCredential ?? false,
        leaseId: lease?.leaseId,
        leaseExpiresAt: lease?.expiresAt,
      } satisfies TerminalSeatProjection;
    });
    return entries.sort((left, right) => {
      const leftRank = left.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.actorId.localeCompare(right.actorId);
    });
  }

  private describeReadProjection(record: TerminalRecord, terminal: ManagedTerminal): TerminalReadProjection {
    return {
      status: terminal.getStatus(),
      title: record.profile.title ?? record.terminalId,
      running: terminal.isRunning(),
    };
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

  private emitFocus(actorId: TerminalActorId): void {
    const terminalIds = this.getFocusedTerminalIds(actorId);
    const payload = {
      actorId,
      terminalIds,
      terminalId: terminalIds[0] ?? null,
    };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
  }

  private emitApprovalRequest(payload: { terminalId: string; request: TerminalApprovalRequestRecord }): void {
    for (const listener of this.approvalRequestListeners) {
      listener(payload);
    }
  }

  private emitChange(payload: TerminalChangePayload): void {
    for (const listener of this.changeListeners) {
      listener(payload);
    }
  }

  private assertActorId(actorId: string): void {
    if (!isCanonicalActorId(actorId)) {
      throw new Error(`invalid actor id: ${actorId}`);
    }
  }

  private resolveGrantAccessToken(input?: string): string {
    const value = input?.trim();
    if (!value) {
      return createOpaqueToken();
    }
    if (!ACCESS_TOKEN_PATTERN.test(value)) {
      throw new Error("invalid access token format");
    }
    return value;
  }

  private touchActorPresence(actorId: TerminalActorId): void {
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt: actorId.startsWith("auth:")
        ? Date.now() + TRANSIENT_ACTOR_PRESENCE_TTL_MS
        : (current?.expiresAt ?? null),
      invalidCredential: current?.invalidCredential ?? false,
    });
  }

  private pruneExpiredPresence(): TerminalActorId[] {
    const now = Date.now();
    const expiredActors: TerminalActorId[] = [];
    for (const [actorId, presence] of [...this.actorPresence.entries()]) {
      if (presence.expiresAt !== null && presence.expiresAt <= now) {
        this.actorPresence.delete(actorId);
        expiredActors.push(actorId as TerminalActorId);
      }
    }
    return expiredActors;
  }

  private expireApprovalsAndLeases(): void {
    const expiredActors = this.pruneExpiredPresence();
    this.db.revokeExpiredLeases();
    for (const record of this.db.listTerminals()) {
      for (const request of this.db.listPendingApprovalRequests(record.terminalId)) {
        if (request.expiresAt > Date.now()) {
          continue;
        }
        const expired = this.db.updateApprovalRequest(record.terminalId, request.requestId, {
          status: "expired",
          decidedAt: Date.now(),
          decidedBy: null,
        });
        this.emitApprovalRequest({ terminalId: record.terminalId, request: expired });
        this.emitChange({
          terminalId: record.terminalId,
          reason: "approval",
          actorId: request.participantId,
        });
      }
    }
    for (const actorId of expiredActors) {
      this.emitPresenceChanged(actorId);
    }
  }

  private syncAdminAssignments(terminalId?: string): void {
    this.expireApprovalsAndLeases();
    const terminalIds = terminalId ? [terminalId] : this.db.listTerminals().map((record) => record.terminalId);
    for (const id of terminalIds) {
      const currentAdminId = this.resolveCurrentAdminActorId(id);
      for (const request of this.db.listPendingApprovalRequests(id)) {
        if (request.assignedAdminId === currentAdminId) {
          continue;
        }
        const updated = this.db.updateApprovalRequest(id, request.requestId, {
          assignedAdminId: currentAdminId ?? null,
        });
        this.emitApprovalRequest({ terminalId: id, request: updated });
        this.emitChange({
          terminalId: id,
          reason: "approval",
          actorId: request.participantId,
        });
      }
    }
  }

  private resolveCurrentAdminActorId(terminalId: string): TerminalActorId | null {
    const candidates = this.db.listAdminCandidates(terminalId);
    this.pruneExpiredPresence();
    for (const candidate of candidates) {
      const grant = this.getGrantForActor(terminalId, candidate.participantId);
      const presence = this.actorPresence.get(candidate.participantId);
      if (grant && presence?.online) {
        return candidate.participantId;
      }
    }
    return null;
  }

  private readAdminCandidateRank(terminalId: string, actorId: TerminalActorId): number | undefined {
    return this.db.listAdminCandidates(terminalId).find((candidate) => candidate.participantId === actorId)?.priority;
  }

  private mergeAdminCandidate(
    terminalId: string,
    participantId: TerminalActorId,
    priority: number,
  ): TerminalAdminCandidateRecord[] {
    const candidates = this.db
      .listAdminCandidates(terminalId)
      .filter((candidate) => candidate.participantId !== participantId);
    candidates.push({
      terminalId,
      participantId,
      priority: Math.max(0, Math.floor(priority)),
    });
    return candidates;
  }

  private getGrantForActor(terminalId: string, actorId: TerminalActorId): TerminalGrantRecord | undefined {
    return this.db
      .listActiveGrants(terminalId)
      .find((grant) => grant.participantId === actorId && !this.isTrustedBootstrapGrant(grant));
  }

  private requireGrantForActor(terminalId: string, actorId: TerminalActorId): TerminalGrantRecord {
    const grant = this.getGrantForActor(terminalId, actorId);
    if (!grant) {
      throw new Error(`terminal access denied for actor: ${actorId}`);
    }
    return grant;
  }

  private ensureActorAccess(
    terminalId: string,
    actorId: TerminalActorId,
    role: TerminalGrantRole,
    preferredToken?: string,
    label?: string,
  ): TerminalAccessProjection {
    this.assertActorId(actorId);
    const existing = this.db.findReusableGrant({ terminalId, participantId: actorId, role });
    if (existing?.accessToken) {
      return this.createAccessProjection(terminalId, existing);
    }
    const accessToken = this.resolveGrantAccessToken(preferredToken);
    this.db.revokeActiveGrantsByParticipant(terminalId, actorId);
    const grant = this.db.issueGrant({
      terminalId,
      participantId: actorId,
      role,
      label: label ?? (actorId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID ? TRUSTED_BOOTSTRAP_LABEL : undefined),
      accessToken,
      tokenHash: hashToken(accessToken),
    });
    return this.createAccessProjection(terminalId, grant);
  }

  private issueTrustedBootstrapAccess(terminalId: string): TerminalAccessProjection {
    return this.ensureActorAccess(
      terminalId,
      TRUSTED_BOOTSTRAP_PARTICIPANT_ID,
      "admin",
      undefined,
      TRUSTED_BOOTSTRAP_LABEL,
    );
  }

  private getTrustedBootstrapAccess(terminalId: string): TerminalAccessProjection | undefined {
    const grant = this.getTrustedBootstrapGrant(terminalId);
    return grant ? this.createAccessProjection(terminalId, grant) : undefined;
  }

  private emitPresenceChanged(actorId: TerminalActorId): void {
    for (const record of this.db.listTerminals()) {
      if (!this.getGrantForActor(record.terminalId, actorId)) {
        continue;
      }
      this.emitChange({
        terminalId: record.terminalId,
        reason: "presence",
        actorId,
      });
    }
  }

  private createAccessProjection(terminalId: string, grant: TerminalGrantRecord): TerminalAccessProjection {
    const currentAdminId = this.resolveCurrentAdminActorId(terminalId);
    const lease = grant.participantId ? this.db.findActiveLease(terminalId, grant.participantId) : undefined;
    return {
      role: grant.role,
      accessToken: grant.accessToken ?? "",
      participantId: grant.participantId,
      currentAdmin: currentAdminId === grant.participantId,
      adminCandidateRank: grant.participantId
        ? this.readAdminCandidateRank(terminalId, grant.participantId)
        : undefined,
      leaseId: lease?.leaseId,
      leaseExpiresAt: lease?.expiresAt,
    };
  }

  private isTrustedBootstrapGrant(grant: Pick<TerminalGrantRecord, "role" | "label" | "participantId">): boolean {
    return (
      grant.role === "admin" &&
      grant.label === TRUSTED_BOOTSTRAP_LABEL &&
      grant.participantId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID
    );
  }

  private requireAccess(terminalId: string, accessToken: string, minimumRole: TerminalGrantRole): TerminalGrantRecord {
    const grant = this.db.findActiveGrantByToken(terminalId, accessToken, hashToken(accessToken));
    if (!grant) {
      throw new Error(`terminal access denied: ${terminalId}`);
    }
    if (grant.participantId) {
      this.touchActorPresence(grant.participantId);
    }
    if (roleRank(grant.role) < roleRank(minimumRole)) {
      throw new Error(`terminal access requires ${minimumRole}`);
    }
    return grant;
  }

  private resolveGrant(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    accessToken?: string;
  }): TerminalGrantRecord {
    if (input.accessToken) {
      const grant = this.requireAccess(input.terminalId, input.accessToken, "readonly");
      if (input.actorId && grant.participantId !== input.actorId) {
        throw new Error("actor credential mismatch");
      }
      return grant;
    }
    if (input.actorId) {
      this.touchActorPresence(input.actorId);
      return this.requireGrantForActor(input.terminalId, input.actorId);
    }
    const trustedBootstrapGrant = this.getTrustedBootstrapGrant(input.terminalId);
    if (!trustedBootstrapGrant) {
      throw new Error(`terminal access denied: ${input.terminalId}`);
    }
    return trustedBootstrapGrant;
  }

  private getTrustedBootstrapGrant(terminalId: string): TerminalGrantRecord | undefined {
    return this.db.listActiveGrants(terminalId).find((grant) => this.isTrustedBootstrapGrant(grant));
  }

  private resolveEventActorId(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): TerminalActorId | undefined {
    if (input.superadminActorId) {
      return input.superadminActorId;
    }
    if (input.actorId) {
      return input.actorId;
    }
    if (!input.accessToken) {
      return undefined;
    }
    return this.resolveGrant({
      terminalId: input.terminalId,
      accessToken: input.accessToken,
    }).participantId;
  }

  private authorizeRead(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): void {
    this.requireRecord(input.terminalId);
    if (input.superadminActorId) {
      this.assertActorId(input.superadminActorId);
      return;
    }
    if (!input.actorId && !input.accessToken) {
      return;
    }
    this.resolveGrant(input);
  }

  private authorizeWrite(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): { ok: boolean; grant?: TerminalGrantRecord; lease?: TerminalWriteLeaseRecord | null; message?: string } {
    if (input.superadminActorId) {
      this.assertActorId(input.superadminActorId);
      return { ok: true, lease: null };
    }
    const grant = this.resolveGrant(input);
    if (!grant.participantId) {
      return { ok: true, grant, lease: null };
    }
    const currentAdminId = this.resolveCurrentAdminActorId(input.terminalId);
    const currentAdminWritesDirect = currentAdminId === grant.participantId && grant.role === "requester";
    if (grant.role === "admin" || grant.role === "writer" || currentAdminWritesDirect) {
      return { ok: true, grant, lease: null };
    }
    if (grant.role === "readonly") {
      return { ok: false, grant, message: "terminal is readonly" };
    }
    const lease = this.db.findActiveLease(input.terminalId, grant.participantId);
    if (lease) {
      return { ok: true, grant, lease };
    }
    return { ok: false, grant, lease: null, message: "terminal write requires approval" };
  }

  private requireAdministrativeAuthority(
    terminalId: string,
    input: { accessToken?: string; actorId?: TerminalActorId; superadminActorId?: TerminalActorId },
  ): TerminalActorId | null {
    if (input.superadminActorId) {
      this.assertActorId(input.superadminActorId);
      return null;
    }
    const grant = this.resolveGrant({ terminalId, actorId: input.actorId, accessToken: input.accessToken });
    if (this.isTrustedBootstrapGrant(grant)) {
      return null;
    }
    const currentAdminId = this.resolveCurrentAdminActorId(terminalId);
    if (!currentAdminId || grant.participantId !== currentAdminId) {
      throw new Error("terminal local admin required");
    }
    return currentAdminId;
  }

  private createApprovalRequest(input: {
    terminalId: string;
    actorId: TerminalActorId;
    requestedInput?: TerminalApprovalRequestRecord["requestedInput"];
  }): TerminalApprovalRequestRecord {
    const expiresAt = Date.now() + (this.config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS);
    const request = this.db.createApprovalRequest({
      terminalId: input.terminalId,
      participantId: input.actorId,
      assignedAdminId: this.resolveCurrentAdminActorId(input.terminalId) ?? undefined,
      expiresAt,
      requestedInput: input.requestedInput,
    });
    this.emitApprovalRequest({ terminalId: input.terminalId, request });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "approval",
      actorId: input.actorId,
    });
    return request;
  }

  private requirePendingApprovalRequest(terminalId: string, requestId: string): TerminalApprovalRequestRecord {
    const request = this.db.getApprovalRequest(terminalId, requestId);
    if (!request || request.status !== "pending") {
      throw new Error(`unknown pending terminal approval request: ${requestId}`);
    }
    if (request.expiresAt <= Date.now()) {
      const expired = this.db.updateApprovalRequest(terminalId, request.requestId, {
        status: "expired",
        decidedAt: Date.now(),
      });
      this.emitApprovalRequest({ terminalId, request: expired });
      this.emitChange({
        terminalId,
        reason: "approval",
        actorId: request.participantId,
      });
      throw new Error(`terminal approval request expired: ${requestId}`);
    }
    return request;
  }

  private requireRecord(terminalId: string): TerminalRecord {
    const record = this.db.getTerminal(terminalId);
    if (!record) {
      throw new Error(`unknown terminal: ${terminalId}`);
    }
    return record;
  }

  private attachReadEvent(payload: TerminalReadResult, actorId?: TerminalActorId): TerminalReadResult {
    const event = this.db.appendEvent({
      terminalId: payload.terminalId,
      kind: "terminal_read",
      payload: {
        title: "Terminal read",
        content: JSON.stringify(payload),
        actorId,
        detail: payload,
      },
    });
    this.emitChange({
      terminalId: payload.terminalId,
      reason: "activity",
      actorId,
    });
    return {
      ...payload,
      eventId: event.eventId,
      recordedActivity: true,
    };
  }

  private finalizeReadResult(
    payload: TerminalReadResult,
    actorId: TerminalActorId | undefined,
    recordActivity: boolean,
  ): TerminalReadResult {
    if (!recordActivity) {
      return {
        ...payload,
        recordedActivity: false,
      };
    }
    return this.attachReadEvent(payload, actorId);
  }
}
