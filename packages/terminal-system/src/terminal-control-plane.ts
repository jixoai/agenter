import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { isPrincipalId } from "@agenter/principal-crypto";
import {
  buildManagedInvitationAcceptPayload,
  buildManagedInvitationShareDescriptor,
  createManagedInvitationId,
  createManagedInvitationToken,
  digestManagedInvitationPayload,
  hashManagedInvitationToken,
  isManagedInvitationExpired,
  parseManagedInvitationDescriptorInput,
  validateManagedInvitationRecipientBinding,
  verifyManagedInvitationAcceptProof,
  type ManagedInvitationEndpointDescriptor,
} from "@agenter/managed-seat-invitation-handshake";
import {
  decodeTerminalTransportClientMessage,
  encodeTerminalTransportServerMessage,
  type TerminalTransportServerMessage,
} from "@agenter/terminal-transport-protocol";
import {
  ManagedTerminal,
  type ManagedTerminalConfig,
  type ManagedTerminalConfigPatch,
  type ManagedTerminalSnapshot,
} from "./managed-terminal";
import {
  DEFAULT_TERMINAL_CURSOR,
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_RENDERER_PREFERENCE,
  DEFAULT_TERMINAL_THEME,
} from "./terminal-control-plane.types";
import type {
  TerminalAccessProjection,
  TerminalActorId,
  TerminalAdminCandidateRecord,
  TerminalApprovalRequestRecord,
  TerminalAutomationInputMode,
  TerminalAwaitInput,
  TerminalAwaitMatchEvidence,
  TerminalAwaitMatchOptions,
  TerminalAwaitOutcome,
  TerminalAwaitResult,
  TerminalAwaitUntil,
  TerminalControlPlaneConfig,
  TerminalControlPlaneConfigPatch,
  TerminalControlPlaneEntry,
  TerminalConfigMutationResult,
  TerminalConfigView,
  TerminalCreateInput,
  TerminalEventRecord,
  TerminalFocusOp,
  TerminalFontProfile,
  TerminalGrantWriteLeaseInput,
  TerminalGrantRecord,
  TerminalGrantRole,
  TerminalInvitationRecord,
  TerminalInviteSeatInput,
  TerminalIssueGrantInput,
  TerminalIssuedGrant,
  TerminalManagedSeatClass,
  TerminalManagedSeatPayload,
  TerminalConfigSeatInput,
  TerminalRevokeSeatInput,
  TerminalAcceptSeatInput,
  TerminalInputInput,
  TerminalPatchInput,
  TerminalProcessProfile,
  TerminalReadMode,
  TerminalReadProjection,
  TerminalReadResult,
  TerminalRecord,
  TerminalRevokeWriteLeaseInput,
  TerminalReverseCursor,
  TerminalReversePage,
  TerminalSeatProjection,
  TerminalShortcutMap,
  TerminalTransportConfig,
  TerminalTransportEndpoint,
  TerminalWriteInput,
  TerminalWriteLeaseRecord,
  TerminalWriteResult,
} from "./terminal-control-plane.types";
import { TerminalDb } from "./terminal-db";
import { resolveDefaultInteractiveShellCommand } from "./default-shell-command";
import type { TerminalLifecycleTransition, TerminalObservedIdentity } from "./terminal-runtime-truth";
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
  binaryTypeConfigured: boolean;
}

type TerminalChangeReason =
  | "created"
  | "updated"
  | "deleted"
  | "identity"
  | "lifecycle"
  | "transition"
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

interface TerminalReadCursorProjection {
  readerActorId: TerminalActorId;
  fromHash: string | null;
  toHash: string | null;
  consumed: boolean;
}

const TRUSTED_BOOTSTRAP_LABEL = "Trusted terminal bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID = "system:trusted-terminal-bootstrap" as const satisfies TerminalActorId;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const LEGACY_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const DEFAULT_APPROVAL_TIMEOUT_MS = 90_000;
const TRANSIENT_ACTOR_PRESENCE_TTL_MS = 90_000;
const DEFAULT_AWAIT_TIMEOUT_MS = 30_000;
const MAX_AWAIT_TIMEOUT_MS = 600_000;
const DEFAULT_AWAIT_IDLE_MS = 250;
const MAX_AWAIT_IDLE_MS = 30_000;
const DEFAULT_AWAIT_VIEW_LINES = 80;
const MAX_AWAIT_VIEW_LINES = 500;
const MAX_AWAIT_CONTEXT_LINES = 10;
const DEFAULT_MANAGED_INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const createId = (): string => `term-${randomUUID()}`;
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
const cloneMetadata = (input?: Record<string, unknown>): Record<string, unknown> => ({ ...(input ?? {}) });
const cloneFontProfile = (input?: TerminalFontProfile): TerminalFontProfile => ({
  family: input?.family ?? DEFAULT_TERMINAL_FONT.family,
  sizePx: input?.sizePx ?? DEFAULT_TERMINAL_FONT.sizePx,
  lineHeight: input?.lineHeight ?? DEFAULT_TERMINAL_FONT.lineHeight,
  letterSpacing: input?.letterSpacing ?? DEFAULT_TERMINAL_FONT.letterSpacing,
  weight: input?.weight ?? DEFAULT_TERMINAL_FONT.weight,
  weightBold: input?.weightBold ?? DEFAULT_TERMINAL_FONT.weightBold,
  ligatures: input?.ligatures ?? DEFAULT_TERMINAL_FONT.ligatures,
});
const normalizeProfile = (profile: TerminalProcessProfile): TerminalProcessProfile => ({
  ...profile,
  rendererPreference: profile.rendererPreference ?? DEFAULT_TERMINAL_RENDERER_PREFERENCE,
  theme: profile.theme ?? DEFAULT_TERMINAL_THEME,
  cursor: profile.cursor ?? DEFAULT_TERMINAL_CURSOR,
  font: cloneFontProfile(profile.font),
});

const cloneProfile = (input?: TerminalProcessProfile): TerminalProcessProfile =>
  normalizeProfile({
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
    rendererPreference: input?.rendererPreference,
    theme: input?.theme,
    cursor: input?.cursor,
    font: input?.font ? cloneFontProfile(input.font) : undefined,
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
    if (profile.rendererPreference !== undefined) {
      merged.rendererPreference = profile.rendererPreference;
    }
    if (profile.theme !== undefined) {
      merged.theme = profile.theme;
    }
    if (profile.cursor !== undefined) {
      merged.cursor = profile.cursor;
    }
    if (profile.font !== undefined) {
      merged.font = cloneFontProfile(profile.font);
    }
  }
  return normalizeProfile(merged);
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
  processPhase: projection.processPhase,
  lifecycleTransition: projection.lifecycleTransition ?? null,
  title: projection.title,
  configuredTitle: projection.configuredTitle,
  currentTitle: projection.currentTitle,
  currentPath: projection.currentPath,
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
  processPhase: projection.processPhase,
  lifecycleTransition: projection.lifecycleTransition ?? null,
  title: projection.title,
  configuredTitle: projection.configuredTitle,
  currentTitle: projection.currentTitle,
  currentPath: projection.currentPath,
  running: projection.running,
});

const attachReadCursor = (
  payload: TerminalReadResult,
  readCursor: TerminalReadCursorProjection | null,
): TerminalReadResult => {
  if (!readCursor) {
    return payload;
  }
  return {
    ...payload,
    fromHash: payload.fromHash ?? readCursor.fromHash,
    toHash: payload.toHash ?? readCursor.toHash,
    readCursor,
  };
};

const normalizePositiveInt = (value: number | undefined, fallback: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(0, Math.floor(value)), max);
};

const normalizeAwaitUntil = (input: TerminalAwaitInput): TerminalAwaitUntil => {
  if (input.wait?.until) {
    return input.wait.until;
  }
  return input.match ? "match" : "changed";
};

const resolveAwaitViewLines = (input: TerminalAwaitInput): number =>
  Math.max(1, normalizePositiveInt(input.view?.lines, DEFAULT_AWAIT_VIEW_LINES, MAX_AWAIT_VIEW_LINES));

const resolveAwaitEvidenceLines = (lines: readonly string[], viewLines: number): string[] => {
  let end = lines.length;
  while (end > 0 && (lines[end - 1] ?? "").trim().length === 0) {
    end -= 1;
  }
  const source = end > 0 ? lines.slice(0, end) : lines;
  return source.slice(-viewLines);
};

const createLiteralMatch = (
  line: string,
  pattern: string,
  caseInsensitive: boolean,
): { index: number; text: string } | null => {
  const normalizedLine = caseInsensitive ? line.toLocaleLowerCase() : line;
  const normalizedPattern = caseInsensitive ? pattern.toLocaleLowerCase() : pattern;
  const index = normalizedLine.indexOf(normalizedPattern);
  if (index < 0) {
    return null;
  }
  return {
    index,
    text: line.slice(index, index + pattern.length),
  };
};

const createRegexMatcher = (input: TerminalAwaitMatchOptions): RegExp => {
  const flags = input.caseInsensitive ? "iu" : "u";
  return new RegExp(input.pattern, flags);
};

const matchSnapshotLines = (
  lines: readonly string[],
  input: TerminalAwaitMatchOptions | undefined,
): { matched: boolean; matches: TerminalAwaitMatchEvidence[] } | undefined => {
  if (!input) {
    return undefined;
  }
  const contextLines = normalizePositiveInt(input.contextLines, 2, MAX_AWAIT_CONTEXT_LINES);
  const matches: TerminalAwaitMatchEvidence[] = [];
  const regex = input.regex ? createRegexMatcher(input) : null;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex] ?? "";
    const match = regex
      ? (() => {
          const found = regex.exec(text);
          return found ? { index: found.index, text: found[0] ?? "" } : null;
        })()
      : createLiteralMatch(text, input.pattern, input.caseInsensitive ?? false);
    if (!match) {
      continue;
    }
    const contextStart = Math.max(0, lineIndex - contextLines);
    const contextEnd = Math.min(lines.length, lineIndex + contextLines + 1);
    matches.push({
      lineIndex,
      text,
      matchedText: match.text,
      contextLines: lines.slice(contextStart, contextEnd),
    });
  }
  return {
    matched: matches.length > 0,
    matches,
  };
};

const resolveDisplayTitle = (
  terminalId: string,
  configuredTitle: string | undefined,
  observedIdentity: TerminalObservedIdentity,
): string => observedIdentity.currentTitle ?? configuredTitle ?? terminalId;

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
  private readonly lifecycleTransitions = new Map<string, TerminalLifecycleTransition>();
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
    this.normalizeRecoveredLifecycle();
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

  listForTrustedBootstrap(): TerminalControlPlaneEntry[] {
    this.expireApprovalsAndLeases();
    return this.db.listTerminals().map((record) =>
      this.describeEntry(record, {
        focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(record.terminalId),
        access: this.issueTrustedBootstrapAccess(record.terminalId),
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
      this.bootstrap(created.terminalId);
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

  bootstrap(terminalId: string): TerminalControlPlaneEntry {
    this.assertLifecycleTransitionIdle(terminalId, "bootstrap");
    const entry = this.ensureManagedEntry(terminalId);
    this.setLifecycleTransition(terminalId, "bootstrapping");
    try {
      if (!entry.terminal.isRunning()) {
        entry.terminal.start();
      }
    } finally {
      this.clearLifecycleTransition(terminalId, "bootstrapping");
    }
    return this.describeEntry(entry.record, {
      focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(terminalId),
      access: this.getTrustedBootstrapAccess(terminalId),
    });
  }

  bootstrapAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalControlPlaneEntry {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return this.bootstrap(input.terminalId);
  }

  async stop(terminalId: string): Promise<{ ok: boolean; message: string }> {
    this.assertLifecycleTransitionIdle(terminalId, "stop");
    const entry = this.entries.get(terminalId);
    const record = this.db.getTerminal(terminalId);
    if (!record) {
      return { ok: false, message: `unknown terminal: ${terminalId}` };
    }
    if (entry?.terminal.isRunning()) {
      this.setLifecycleTransition(terminalId, "killing");
      try {
        await entry.terminal.stop();
      } finally {
        this.clearLifecycleTransition(terminalId, "killing");
      }
    }
    return { ok: true, message: "terminal PTY stopped" };
  }

  async stopAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return await this.stop(input.terminalId);
  }

  async deleteTerminal(terminalId: string): Promise<{ ok: boolean; message: string }> {
    this.assertLifecycleTransitionIdle(terminalId, "delete");
    const entry = this.entries.get(terminalId);
    if (entry?.terminal.isRunning()) {
      this.setLifecycleTransition(terminalId, "killing");
      try {
        await entry.terminal.stop();
      } finally {
        this.clearLifecycleTransition(terminalId, "killing");
      }
    }
    this.lifecycleTransitions.delete(terminalId);
    this.entries.delete(terminalId);
    const existed = this.db.removeTerminal(terminalId);
    if (!existed) {
      return { ok: false, message: `unknown terminal: ${terminalId}` };
    }
    this.db.deleteReadCursors(terminalId);
    for (const [actorId, focused] of this.focusedTerminalIdsByActor.entries()) {
      if (!focused.delete(terminalId)) {
        continue;
      }
      this.emitFocus(actorId as TerminalActorId);
    }
    this.emitChange({ terminalId, reason: "deleted" });
    return { ok: true, message: "terminal deleted" };
  }

  async deleteAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return await this.deleteTerminal(input.terminalId);
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
    if (!this.db.getTerminal(terminalId)) {
      return null;
    }
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
    const host = transport?.host ?? this.transportServer?.url.hostname ?? "127.0.0.1";
    const path = toTransportPath(transport?.pathPrefix ?? "/pty", terminalId);
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
        if (!this.db.getTerminal(terminalId)) {
          return new Response("terminal-not-found", { status: 404 });
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
            binaryTypeConfigured: false,
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
          let lastSentGeometry: { cols: number; rows: number } | null = null;
          let mirrorLiveSnapshots = false;
          const sendSnapshot = (snapshot: ManagedTerminalSnapshot): void => {
            lastSentGeometry = {
              cols: snapshot.cols,
              rows: snapshot.rows,
            };
            socket.send(
              encodeTerminalTransportServerMessage({
                type: "snapshot",
                terminalId: record.terminalId,
                snapshot,
                status: entry.terminal.getStatus(),
              } satisfies TerminalTransportServerMessage),
            );
          };
          cleanup.push(
            entry.terminal.onSnapshot((snapshot) => {
              if (!mirrorLiveSnapshots) {
                return;
              }
              if (
                lastSentGeometry &&
                lastSentGeometry.cols === snapshot.cols &&
                lastSentGeometry.rows === snapshot.rows
              ) {
                return;
              }
              sendSnapshot(snapshot);
            }),
          );
          cleanup.push(
            entry.terminal.onOutputBytes((data) => {
              socket.send(
                encodeTerminalTransportServerMessage({
                  type: "outputBytes",
                  terminalId: record.terminalId,
                  data,
                } satisfies TerminalTransportServerMessage),
              );
            }),
          );
          cleanup.push(
            entry.terminal.onStatus((running, status) => {
              socket.send(
                encodeTerminalTransportServerMessage({
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
          sendSnapshot(entry.terminal.getSnapshot());
          mirrorLiveSnapshots = true;
        },
        message: async (socket, message) => {
          const terminalId = socket.data.terminalId;
          if (!socket.data.binaryTypeConfigured) {
            socket.binaryType = "arraybuffer";
            socket.data.binaryTypeConfigured = true;
          }
          if (typeof message === "string") {
            socket.send(
              encodeTerminalTransportServerMessage({
                type: "error",
                terminalId,
                message: "string websocket frames are not supported by terminal transport v2",
              } satisfies TerminalTransportServerMessage),
            );
            return;
          }
          const parsed = decodeTerminalTransportClientMessage(message);
          if (!parsed) {
            socket.send(
              encodeTerminalTransportServerMessage({
                type: "error",
                terminalId,
                message: "invalid transport message",
              } satisfies TerminalTransportServerMessage),
            );
            return;
          }
          try {
            if (parsed.type === "inputBytes") {
              this.forwardInteractiveInputBytes({
                terminalId,
                data: parsed.data,
                accessToken: socket.data.accessToken,
                actorId: socket.data.actorId ?? undefined,
              });
              return;
            }
            if (parsed.type === "resize") {
              this.ensureManagedEntry(terminalId).terminal.resize(parsed.cols, parsed.rows);
              return;
            }
          } catch (error) {
            socket.send(
              encodeTerminalTransportServerMessage({
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
    const readerActorId = this.resolveReadCursorActorId(input);
    const consumeReadCursor = input.remark ?? false;
    const entry = this.ensureManagedEntry(input.terminalId);
    const mode = input.mode ?? "auto";
    const snapshot = await entry.terminal.read();
    const projection = this.describeReadProjection(entry.record, entry.terminal);
    let snapshotPayload = buildSnapshotPayload(input.terminalId, snapshot, projection);
    if (entry.record.profile.gitLog && mode !== "snapshot") {
      const cursorHash = readerActorId
        ? (this.db.getReadCursor(input.terminalId, readerActorId)?.cursorHash ?? null)
        : null;
      const diff = await entry.terminal.sliceDirty({ fromHash: cursorHash, wait: false });
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
        const readCursor = readerActorId
          ? {
              readerActorId,
              fromHash: diff.fromHash,
              toHash: diff.toHash,
              consumed: consumeReadCursor,
            }
          : null;
        const shouldUseDiff =
          mode === "diff" || JSON.stringify(diffPayload).length <= JSON.stringify(snapshotPayload).length;
        if (shouldUseDiff) {
          this.commitReadCursor(input.terminalId, readCursor);
          return this.finalizeReadResult(
            attachReadCursor(diffPayload, readCursor),
            actorId,
            input.recordActivity ?? true,
          );
        }
      }
      const readCursor = readerActorId
        ? {
            readerActorId,
            fromHash: diff.ok ? diff.fromHash : cursorHash,
            toHash: diff.ok ? diff.toHash : cursorHash,
            consumed: consumeReadCursor,
          }
        : null;
      this.commitReadCursor(input.terminalId, readCursor);
      snapshotPayload = attachReadCursor(snapshotPayload, readCursor);
    } else if (entry.record.profile.gitLog && mode === "snapshot") {
      const cursorHash = readerActorId
        ? (this.db.getReadCursor(input.terminalId, readerActorId)?.cursorHash ?? null)
        : null;
      const mark = consumeReadCursor ? await entry.terminal.markDirty() : null;
      const readCursor = readerActorId
        ? {
            readerActorId,
            fromHash: cursorHash,
            toHash: mark?.ok ? mark.hash : cursorHash,
            consumed: consumeReadCursor,
          }
        : null;
      this.commitReadCursor(input.terminalId, readCursor);
      snapshotPayload = attachReadCursor(snapshotPayload, readCursor);
    }
    return this.finalizeReadResult(snapshotPayload, actorId, input.recordActivity ?? true);
  }

  async awaitAuthorized(input: TerminalAwaitInput): Promise<TerminalAwaitResult> {
    this.authorizeRead(input);
    const actorId = this.resolveEventActorId(input);
    const entry = this.ensureManagedEntry(input.terminalId);
    const startedAt = Date.now();
    const until = normalizeAwaitUntil(input);
    const timeoutMs = normalizePositiveInt(input.wait?.timeoutMs, DEFAULT_AWAIT_TIMEOUT_MS, MAX_AWAIT_TIMEOUT_MS);
    const idleMs = normalizePositiveInt(input.wait?.idleMs, DEFAULT_AWAIT_IDLE_MS, MAX_AWAIT_IDLE_MS);
    const fromHash = input.wait?.fromHash ?? entry.terminal.getHeadHash();
    const fromSeq = Number.parseInt(fromHash ?? "0", 10);
    const afterSeq = Number.isFinite(fromSeq) ? fromSeq : 0;
    if ((until === "match" || until === "absent") && !input.match) {
      throw new Error(`terminal await until=${until} requires match.pattern`);
    }
    if (input.match?.regex) {
      createRegexMatcher(input.match);
    }

    let lastSnapshot = entry.terminal.getSnapshot();
    if (!entry.terminal.isRunning()) {
      return this.finalizeAwaitResult(
        this.buildAwaitResult({
          entry,
          input,
          snapshot: lastSnapshot,
          outcome: "stopped",
          startedAt,
          fromHash,
        }),
        actorId,
        input.recordActivity ?? true,
      );
    }

    return await new Promise<TerminalAwaitResult>((resolve) => {
      let settled = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
      const cleanupFns: Array<() => void> = [];
      let commitWaiter: {
        promise: Promise<{ toHash: string | null }>;
        reject: (reason: unknown) => void;
      } | null = null;

      const clearIdleTimer = (): void => {
        if (idleTimer !== null) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      const cleanup = (): void => {
        clearIdleTimer();
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (commitWaiter) {
          commitWaiter.reject(new Error("terminal await settled"));
          commitWaiter = null;
        }
        for (const fn of cleanupFns.splice(0)) {
          fn();
        }
      };

      const finish = (outcome: TerminalAwaitOutcome, snapshot: ManagedTerminalSnapshot = lastSnapshot): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        const result = this.finalizeAwaitResult(
          this.buildAwaitResult({
            entry,
            input,
            snapshot,
            outcome,
            startedAt,
            fromHash,
          }),
          actorId,
          input.recordActivity ?? true,
        );
        resolve(result);
      };

      const evaluate = (snapshot: ManagedTerminalSnapshot): TerminalAwaitOutcome | null => {
        if (!entry.terminal.isRunning()) {
          return "stopped";
        }
        if (until === "changed") {
          return snapshot.seq > afterSeq ? "changed" : null;
        }
        if (until === "idle") {
          return entry.terminal.getStatus() === "IDLE" ? "idle" : null;
        }
        if (!input.match) {
          return null;
        }
        const matched = matchSnapshotLines(snapshot.lines, input.match)?.matched ?? false;
        if (until === "match") {
          return matched ? "matched" : null;
        }
        return matched ? null : "absent";
      };

      const scheduleStableFinish = (outcome: TerminalAwaitOutcome, snapshot: ManagedTerminalSnapshot): void => {
        clearIdleTimer();
        if (idleMs === 0 || outcome === "stopped" || outcome === "cancelled" || outcome === "timeout") {
          finish(outcome, snapshot);
          return;
        }
        idleTimer = setTimeout(() => {
          idleTimer = null;
          const latest = lastSnapshot;
          const latestOutcome = evaluate(latest);
          if (latestOutcome === outcome || outcome === "changed") {
            finish(outcome, latest);
          }
        }, idleMs);
      };

      const observeSnapshot = (snapshot: ManagedTerminalSnapshot): void => {
        if (settled) {
          return;
        }
        lastSnapshot = snapshot;
        const outcome = evaluate(snapshot);
        if (outcome) {
          scheduleStableFinish(outcome, snapshot);
          return;
        }
        clearIdleTimer();
      };

      cleanupFns.push(
        entry.terminal.onSnapshot((snapshot) => {
          observeSnapshot(snapshot);
        }),
      );
      cleanupFns.push(
        entry.terminal.onStatus((running, status) => {
          if (settled) {
            return;
          }
          if (!running) {
            finish("stopped", lastSnapshot);
            return;
          }
          if (status === "BUSY" && until === "idle") {
            clearIdleTimer();
            return;
          }
          if (status === "IDLE") {
            observeSnapshot(entry.terminal.getSnapshot());
          }
        }),
      );

      if (until === "changed") {
        commitWaiter = entry.terminal.waitCommitted({ fromHash });
        commitWaiter.promise
          .then(() => {
            if (settled) {
              return;
            }
            lastSnapshot = entry.terminal.getSnapshot();
            scheduleStableFinish("changed", lastSnapshot);
          })
          .catch(() => {
            if (!settled) {
              finish(entry.terminal.isRunning() ? "cancelled" : "stopped", lastSnapshot);
            }
          });
      }

      if (input.signal) {
        const abort = (): void => finish("cancelled", lastSnapshot);
        if (input.signal.aborted) {
          abort();
          return;
        }
        input.signal.addEventListener("abort", abort, { once: true });
        cleanupFns.push(() => input.signal?.removeEventListener("abort", abort));
      }

      timeoutTimer = setTimeout(() => {
        finish("timeout", lastSnapshot);
      }, timeoutMs);

      observeSnapshot(lastSnapshot);
    });
  }

  async snapshot(
    terminalId: string,
    options: { remark?: boolean; recordActivity?: boolean } = {},
  ): Promise<TerminalReadResult> {
    return await this.read(terminalId, "snapshot", options);
  }

  async write(input: TerminalWriteInput): Promise<TerminalWriteResult> {
    return await this.enqueueAutomationInput({
      terminalId: input.terminalId,
      text: input.text,
      mode: "raw",
      title: "Terminal write",
      actorId: input.actorId,
      accessToken: input.accessToken,
      superadminActorId: input.superadminActorId,
      createApprovalRequest: input.createApprovalRequest,
      returnRead: input.returnRead,
      readMode: input.readMode,
      readRecordActivity: input.readRecordActivity,
    });
  }

  async input(input: TerminalInputInput): Promise<TerminalWriteResult> {
    return await this.enqueueAutomationInput({
      terminalId: input.terminalId,
      text: input.text,
      mode: "mixed",
      title: "Terminal input",
      actorId: input.actorId,
      accessToken: input.accessToken,
      superadminActorId: input.superadminActorId,
      createApprovalRequest: input.createApprovalRequest,
      returnRead: input.returnRead,
      readMode: input.readMode,
      readRecordActivity: input.readRecordActivity,
    });
  }

  private async enqueueAutomationInput(input: {
    terminalId: string;
    text: string;
    mode: TerminalAutomationInputMode;
    title: string;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
    readMode?: TerminalReadMode;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
    createApprovalRequest?: boolean;
  }): Promise<TerminalWriteResult> {
    const failureMessage = (reason?: string): string => {
      const suffix = reason ? ` (${reason})` : "";
      return `${input.title} failed before reaching the PTY${suffix}`;
    };
    const transition = this.getLifecycleTransition(input.terminalId);
    if (transition) {
      return {
        ok: false,
        message: `${input.title} requires the terminal lifecycle transition to settle first (${transition})`,
      };
    }
    const entry = this.ensureManagedEntry(input.terminalId);
    if (!entry.terminal.isRunning()) {
      return {
        ok: false,
        message: `${input.title} requires a running terminal PTY`,
      };
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
          mode: input.mode,
          text: input.text,
        },
      });
      return { ok: false, message, approvalRequest: request };
    }

    const pendingResult =
      input.mode === "raw" ? await entry.terminal.write(input.text) : await entry.terminal.input(input.text);
    if (!pendingResult.ok) {
      return {
        ok: false,
        message: failureMessage(pendingResult.reason),
      };
    }
    const writeEvent = this.db.appendEvent({
      terminalId: input.terminalId,
      kind: "terminal_write",
      payload: {
        title: input.title,
        content: input.text,
        actorId: this.resolveEventActorId(input),
        detail: {
          mode: input.mode,
          leaseId: decision.lease?.leaseId,
        },
      },
    });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "activity",
      actorId: this.resolveEventActorId(input),
    });
    if (!input.returnRead) {
      return {
        ok: true,
        message: "written",
        eventId: writeEvent.eventId,
        leaseId: decision.lease?.leaseId,
      };
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
    return {
      ok: true,
      message: "written",
      eventId: writeEvent.eventId,
      leaseId: decision.lease?.leaseId,
      read,
    };
  }

  private forwardInteractiveInputBytes(input: {
    terminalId: string;
    data: Uint8Array;
    actorId?: TerminalActorId;
    accessToken?: string;
    superadminActorId?: TerminalActorId;
  }): void {
    const transition = this.getLifecycleTransition(input.terminalId);
    if (transition) {
      throw new Error(`Terminal live input bytes require the terminal lifecycle transition to settle first (${transition})`);
    }
    const entry = this.ensureManagedEntry(input.terminalId);
    if (!entry.terminal.isRunning()) {
      throw new Error("Terminal live input bytes require a running terminal PTY");
    }
    const decision = this.authorizeWrite({
      terminalId: input.terminalId,
      actorId: input.actorId,
      accessToken: input.accessToken,
      superadminActorId: input.superadminActorId,
    });
    if (!decision.ok) {
      throw new Error(decision.message ?? "terminal write denied");
    }
    entry.terminal.writeRawBytes(input.data);
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

  async markDirty(
    terminalId: string,
    actorId?: TerminalActorId,
  ): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    const mark = await this.ensureManagedEntry(terminalId).terminal.markDirty();
    if (mark.ok && actorId) {
      this.db.upsertReadCursor({
        terminalId,
        readerActorId: actorId,
        cursorHash: mark.hash,
      });
    }
    return mark;
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

  getTerminalConfig(terminalId: string): TerminalConfigView {
    return this.describeTerminalConfig(this.requireRecord(terminalId));
  }

  getTerminalConfigAuthorized(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalConfigView {
    this.requireAdministrativeAuthority(input.terminalId, input);
    return this.getTerminalConfig(input.terminalId);
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
    const { record } = this.applyTerminalConfigPatch(input.terminalId, input);
    this.emitChange({ terminalId: input.terminalId, reason: "updated", actorId: input.actorId });
    return this.describeEntry(record, {
      focused: this.getFocusedTerminalIds(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).includes(input.terminalId),
      access: input.actorId
        ? this.createAccessProjection(input.terminalId, this.requireGrantForActor(input.terminalId, input.actorId))
        : this.getTrustedBootstrapAccess(input.terminalId),
    });
  }

  setTerminalConfigAuthorized(
    input: {
      terminalId: string;
      accessToken?: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } & TerminalPatchInput,
  ): TerminalConfigMutationResult {
    this.requireAdministrativeAuthority(input.terminalId, {
      accessToken: input.accessToken,
      actorId: input.actorId,
      superadminActorId: input.superadminActorId,
    });
    const result = this.applyTerminalConfigPatch(input.terminalId, input);
    this.emitChange({ terminalId: input.terminalId, reason: "updated", actorId: input.actorId });
    if (input.cols !== undefined || input.rows !== undefined) {
      const cols = result.record.profile.cols ?? undefined;
      const rows = result.record.profile.rows ?? undefined;
      this.db.appendEvent({
        terminalId: input.terminalId,
        kind: "terminal_resize",
        payload: {
          title: "Terminal resize",
          content: cols && rows ? `${cols}x${rows}` : "Terminal resize",
          actorId: input.actorId ?? input.superadminActorId,
          detail: {
            source: "terminal-config-mutation",
            cols: cols ?? null,
            rows: rows ?? null,
            appliedLiveFields: [...result.appliedLiveFields],
            nextBootstrapFields: [...result.nextBootstrapFields],
          },
        },
      });
    }
    return {
      config: this.describeTerminalConfig(result.record),
      appliedLiveFields: result.appliedLiveFields,
      nextBootstrapFields: result.nextBootstrapFields,
    };
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

  inviteSeatAuthorized(input: TerminalInviteSeatInput): TerminalInvitationRecord {
    const inviterActorId = this.requireAdministrativeAuthority(input.terminalId, input);
    if (!isPrincipalId(input.participantId)) {
      throw new Error("terminal managed seat participantId must be a principal id");
    }
    const invitationId = createManagedInvitationId();
    const previous = this.db.findLatestInvitationForParticipant({
      terminalId: input.terminalId,
      inviteeParticipantId: input.participantId,
    });
    if (previous?.status === "pending") {
      this.db.updateInvitationStatus(input.terminalId, previous.invitationId, {
        status: "revoked",
        revokedAt: Date.now(),
        supersededByInvitationId: invitationId,
      });
    }
    const token = createManagedInvitationToken();
    const payload = this.resolveManagedSeatPayload(input.seatClass, input.label);
    const descriptor = buildManagedInvitationShareDescriptor({
      resourceKind: "terminal",
      token,
      endpoint: input.endpoint,
    });
    const invitation = this.db.upsertInvitation({
      invitationId,
      terminalId: input.terminalId,
      inviterParticipantId: this.resolveManagedSeatInviterPrincipalId(inviterActorId, input.superadminActorId),
      inviteeParticipantId: input.participantId,
      nativePayload: payload,
      payloadDigest: digestManagedInvitationPayload(payload),
      acceptanceTokenHash: hashManagedInvitationToken(token),
      descriptor,
      expiresAt: input.expiresAt ?? Date.now() + DEFAULT_MANAGED_INVITATION_TTL_MS,
    });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "grant-issued",
      actorId: input.participantId,
    });
    return invitation;
  }

  prepareSeatAccept(input: { descriptor: string }): {
    invitation: TerminalInvitationRecord;
    proofInput: {
      invitationId: string;
      resourceKind: TerminalInvitationRecord["resourceKind"];
      resourceId: string;
      inviteePrincipalId: TerminalInvitationRecord["inviteePrincipalId"];
      payloadDigest: string;
      expiresAt: number;
    };
  } {
    const invitation = this.requirePendingInvitationByDescriptor(input.descriptor);
    return {
      invitation,
      proofInput: {
        invitationId: invitation.invitationId,
        resourceKind: invitation.resourceKind,
        resourceId: invitation.resourceId,
        inviteePrincipalId: invitation.inviteePrincipalId,
        payloadDigest: invitation.payloadDigest,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async acceptSeat(input: TerminalAcceptSeatInput): Promise<{
    invitation: TerminalInvitationRecord;
    access: TerminalAccessProjection;
    seat: TerminalSeatProjection | undefined;
  }> {
    const invitation = this.requirePendingInvitationByDescriptor(input.descriptor);
    validateManagedInvitationRecipientBinding({
      expectedInviteePrincipalId: invitation.inviteePrincipalId,
      proof: input.proof,
    });
    if (!(await verifyManagedInvitationAcceptProof(input.proof))) {
      throw new Error("terminal invitation proof verification failed");
    }
    const expectedProofPayload = buildManagedInvitationAcceptPayload({
      invitationId: invitation.invitationId,
      resourceKind: invitation.resourceKind,
      resourceId: invitation.resourceId,
      inviteePrincipalId: invitation.inviteePrincipalId,
      payloadDigest: invitation.payloadDigest,
      expiresAt: invitation.expiresAt,
    });
    if (input.proof.payload !== expectedProofPayload) {
      throw new Error("terminal invitation proof payload digest mismatch");
    }
    const access = this.activateManagedSeatPayload(invitation.resourceId, invitation.inviteePrincipalId, invitation.payload);
    const accepted = this.db.updateInvitationStatus(invitation.resourceId, invitation.invitationId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    this.syncAdminAssignments(invitation.resourceId);
    this.emitChange({
      terminalId: invitation.resourceId,
      reason: "grant-issued",
      actorId: invitation.inviteePrincipalId,
    });
    return {
      invitation: accepted,
      access,
      seat: this.listActorSeats(invitation.resourceId).find((seat) => seat.actorId === invitation.inviteePrincipalId),
    };
  }

  configSeatAuthorized(input: TerminalConfigSeatInput): TerminalInvitationRecord | TerminalAccessProjection {
    this.requireAdministrativeAuthority(input.terminalId, input);
    const existingGrant = this.getGrantForActor(input.terminalId, input.participantId);
    if (existingGrant) {
      return this.activateManagedSeatPayload(
        input.terminalId,
        input.participantId,
        this.resolveManagedSeatPayload(input.seatClass, input.label),
      );
    }
    return this.inviteSeatAuthorized(input);
  }

  revokeSeatAuthorized(input: TerminalRevokeSeatInput): { ok: true } {
    this.requireAdministrativeAuthority(input.terminalId, input);
    this.db.revokePendingInvitationsByParticipant(input.terminalId, input.participantId);
    this.db.revokeActiveGrantsByParticipant(input.terminalId, input.participantId);
    this.db.revokeActiveLeasesByParticipant(input.terminalId, input.participantId);
    const candidates = this.db
      .listAdminCandidates(input.terminalId)
      .filter((candidate) => candidate.participantId !== input.participantId)
      .map((candidate) => candidate.participantId);
    this.db.setAdminGroup(input.terminalId, candidates);
    this.expireApprovalsAndLeases();
    this.syncAdminAssignments(input.terminalId);
    this.emitChange({
      terminalId: input.terminalId,
      reason: "grant-revoked",
      actorId: input.participantId,
    });
    return { ok: true };
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

  grantWriteLeaseAuthorized(input: TerminalGrantWriteLeaseInput): TerminalWriteLeaseRecord {
    const grantedBy = this.requireAdministrativeAuthority(input.terminalId, input) ?? input.superadminActorId;
    const grant = this.requireGrantForActor(input.terminalId, input.participantId);
    if (grant.role === "readonly") {
      throw new Error("terminal is readonly");
    }
    this.db.revokeActiveLeasesByParticipant(input.terminalId, input.participantId);
    const lease = this.db.createWriteLease({
      terminalId: input.terminalId,
      participantId: input.participantId,
      grantedBy,
      expiresAt: Date.now() + Math.max(1_000, input.durationMs),
    });
    this.emitChange({
      terminalId: input.terminalId,
      reason: "approval",
      actorId: input.participantId,
    });
    return lease;
  }

  revokeWriteLeaseAuthorized(input: TerminalRevokeWriteLeaseInput): { ok: true; revokedCount: number } {
    this.requireAdministrativeAuthority(input.terminalId, input);
    const revokedAt = Date.now();
    let revokedCount = 0;
    if (input.leaseId) {
      revokedCount += this.db.revokeWriteLease(input.terminalId, input.leaseId, revokedAt);
    }
    if (input.participantId) {
      revokedCount += this.db.revokeActiveLeasesByParticipant(input.terminalId, input.participantId, revokedAt);
    }
    if (revokedCount > 0) {
      this.emitChange({
        terminalId: input.terminalId,
        reason: "approval",
        actorId: input.participantId,
      });
    }
    return { ok: true, revokedCount };
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
      : [...(this.options.defaultShellCommand ?? resolveDefaultInteractiveShellCommand())];
    const cwd = resolve(profile.cwd ?? homedir());
    return this.db.createTerminal({
      terminalId,
      processKind,
      command,
      launchCwd: cwd,
      profile,
      metadata: cloneMetadata(input.metadata),
      processPhase: "not_started",
      lastStopReason: null,
      lastExitCode: null,
      lastExitSignal: null,
      lastStoppedAt: null,
    });
  }

  private ensureManagedEntry(terminalId: string): ManagedEntry {
    const existing = this.entries.get(terminalId);
    if (existing) {
      return existing;
    }
    const record = this.requireRecord(terminalId);
    const normalizedCwd = resolve(record.launchCwd);
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
    entry.terminal.onObservedIdentity(() => {
      this.emitChange({ terminalId: entry.record.terminalId, reason: "identity" });
    });
    entry.terminal.onLifecycle((event) => {
      entry.record = this.db.updateLifecycle(entry.record.terminalId, event);
      this.emitChange({ terminalId: entry.record.terminalId, reason: "lifecycle" });
    });
    entry.terminal.onStatus((running, status) => {
      this.emitStatus({ terminalId: entry.record.terminalId, running, status });
      this.emitChange({ terminalId: entry.record.terminalId, reason: "status" });
    });
  }

  private applyTerminalConfigPatch(
    terminalId: string,
    input: TerminalPatchInput,
  ): { record: TerminalRecord; appliedLiveFields: string[]; nextBootstrapFields: string[] } {
    this.assertLifecycleTransitionIdle(terminalId, "set-config");
    if (input.adminGroupCandidateIds) {
      input.adminGroupCandidateIds.forEach((actorId) => {
        if (!this.getGrantForActor(terminalId, actorId)) {
          throw new Error(`admin candidate requires an active terminal grant: ${actorId}`);
        }
      });
      this.db.setAdminGroup(terminalId, input.adminGroupCandidateIds);
      this.syncAdminAssignments(terminalId);
    }
    const record = this.db.updateTerminal(terminalId, input);
    const managed = this.entries.get(terminalId);
    const appliedLiveFields: string[] = [];
    const nextBootstrapFields: string[] = [];
    if (managed) {
      managed.record = record;
      const reconfigurePatch: ManagedTerminalConfigPatch = {};
      if (input.command) {
        reconfigurePatch.command = [...record.command];
        if (managed.terminal.isRunning()) {
          nextBootstrapFields.push("command");
        }
      }
      if (input.launchCwd !== undefined) {
        reconfigurePatch.cwd = resolve(record.launchCwd);
        if (managed.terminal.isRunning()) {
          nextBootstrapFields.push("launchCwd");
        }
      }
      if (input.env !== undefined) {
        reconfigurePatch.env = record.profile.env ? { ...record.profile.env } : {};
        if (managed.terminal.isRunning()) {
          nextBootstrapFields.push("env");
        }
      }
      if (input.processKind !== undefined && managed.terminal.isRunning()) {
        nextBootstrapFields.push("processKind");
      }
      if (input.gitLog !== undefined) {
        reconfigurePatch.gitLog = toManagedGitLogMode(record.profile.gitLog);
        if (managed.terminal.isRunning()) {
          nextBootstrapFields.push("gitLog");
        }
      }
      if (input.logStyle !== undefined) {
        reconfigurePatch.logStyle = record.profile.logStyle ?? "rich";
        if (managed.terminal.isRunning()) {
          nextBootstrapFields.push("logStyle");
        }
      }
      if (input.cols !== undefined) {
        reconfigurePatch.cols = record.profile.cols ?? managed.terminal.getSnapshot().cols;
        if (managed.terminal.isRunning()) {
          appliedLiveFields.push("cols");
        } else {
          nextBootstrapFields.push("cols");
        }
      }
      if (input.rows !== undefined) {
        reconfigurePatch.rows = record.profile.rows ?? managed.terminal.getSnapshot().rows;
        if (managed.terminal.isRunning()) {
          appliedLiveFields.push("rows");
        } else {
          nextBootstrapFields.push("rows");
        }
      }
      managed.terminal.reconfigure(reconfigurePatch);
    }
    return { record, appliedLiveFields, nextBootstrapFields };
  }

  private describeEntry(
    record: TerminalRecord,
    input: { focused: boolean; access?: TerminalAccessProjection | null },
  ): TerminalControlPlaneEntry {
    const entry = this.entries.get(record.terminalId);
    const snapshot = entry?.terminal.getSnapshot();
    const observedIdentity = entry?.terminal.getObservedIdentity() ?? {};
    const access = input.access ?? undefined;
    const profile = cloneProfile(record.profile);
    return {
      terminalId: record.terminalId,
      processKind: record.processKind,
      command: [...record.command],
      launchCwd: resolve(record.launchCwd),
      workspace: entry?.terminal.getWorkspace() ?? null,
      status: entry?.terminal.getStatus() ?? "IDLE",
      lifecycleTransition: this.getLifecycleTransition(record.terminalId),
      seq: snapshot?.seq ?? 0,
      snapshot,
      focused: input.focused,
      icon: profile.icon,
      configuredTitle: profile.title,
      currentPath: observedIdentity.currentPath,
      currentTitle: observedIdentity.currentTitle,
      processPhase: entry?.terminal.isRunning() ? "running" : record.processPhase,
      lastStopReason: record.lastStopReason,
      lastExitCode: record.lastExitCode,
      lastExitSignal: record.lastExitSignal,
      lastStoppedAt: record.lastStoppedAt,
      shortcuts: cloneShortcuts(profile.shortcuts),
      rendererPreference: profile.rendererPreference ?? DEFAULT_TERMINAL_RENDERER_PREFERENCE,
      theme: profile.theme ?? DEFAULT_TERMINAL_THEME,
      cursor: profile.cursor ?? DEFAULT_TERMINAL_CURSOR,
      font: cloneFontProfile(profile.font),
      transportUrl: access?.accessToken ? this.getTransportEndpoint(record.terminalId, access.accessToken)?.url : undefined,
      currentAdminId: this.resolveCurrentAdminActorId(record.terminalId),
      approvalTimeoutMs: this.config.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
      pendingRequestCount: this.db.listPendingApprovalRequests(record.terminalId).length,
      metadata: cloneMetadata(record.metadata),
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
    const observedIdentity = terminal.getObservedIdentity();
    return {
      status: terminal.getStatus(),
      processPhase: terminal.isRunning() ? "running" : record.processPhase,
      lifecycleTransition: this.getLifecycleTransition(record.terminalId),
      title: resolveDisplayTitle(record.terminalId, record.profile.title, observedIdentity),
      configuredTitle: record.profile.title,
      currentTitle: observedIdentity.currentTitle,
      currentPath: observedIdentity.currentPath,
      running: terminal.isRunning(),
    };
  }

  private describeTerminalConfig(record: TerminalRecord): TerminalConfigView {
    return {
      terminalId: record.terminalId,
      processKind: record.processKind,
      command: [...record.command],
      launchCwd: resolve(record.launchCwd),
      profile: cloneProfile(record.profile),
      metadata: cloneMetadata(record.metadata),
      processPhase: record.processPhase,
      lifecycleTransition: this.getLifecycleTransition(record.terminalId),
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

  private getLifecycleTransition(terminalId: string): TerminalLifecycleTransition | null {
    return this.lifecycleTransitions.get(terminalId) ?? null;
  }

  private setLifecycleTransition(terminalId: string, transition: TerminalLifecycleTransition): void {
    if (this.lifecycleTransitions.get(terminalId) === transition) {
      return;
    }
    this.lifecycleTransitions.set(terminalId, transition);
    this.emitChange({ terminalId, reason: "transition" });
  }

  private clearLifecycleTransition(terminalId: string, transition?: TerminalLifecycleTransition): void {
    const current = this.lifecycleTransitions.get(terminalId);
    if (!current) {
      return;
    }
    if (transition && transition !== current) {
      return;
    }
    this.lifecycleTransitions.delete(terminalId);
    this.emitChange({ terminalId, reason: "transition" });
  }

  private assertLifecycleTransitionIdle(terminalId: string, action: string): void {
    const transition = this.getLifecycleTransition(terminalId);
    if (!transition) {
      return;
    }
    throw new Error(`terminal ${terminalId} is already ${transition}; wait before ${action}`);
  }

  private normalizeRecoveredLifecycle(): void {
    for (const record of this.db.listTerminals()) {
      if (record.processPhase !== "running") {
        continue;
      }
      this.db.updateLifecycle(record.terminalId, {
        processPhase: "stopped",
        lastStopReason: record.lastStopReason ?? "killed",
        lastExitCode: record.lastExitCode ?? null,
        lastExitSignal: record.lastExitSignal ?? null,
        lastStoppedAt: record.lastStoppedAt ?? Date.now(),
      });
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

  private resolveManagedSeatPayload(seatClass: TerminalManagedSeatClass, label?: string): TerminalManagedSeatPayload {
    if (seatClass === "TM") {
      return {
        seatClass,
        role: "admin",
        label,
        adminCandidateRank: Number.MAX_SAFE_INTEGER / 2,
      };
    }
    return {
      seatClass,
      role: seatClass === "RW" ? "writer" : "readonly",
      label,
      adminCandidateRank: null,
    };
  }

  private requirePendingInvitationByDescriptor(descriptor: string): TerminalInvitationRecord {
    this.db.expirePendingInvitations();
    const { token } = parseManagedInvitationDescriptorInput(descriptor);
    const invitation = this.db.findInvitationByTokenHash(hashManagedInvitationToken(token));
    if (!invitation) {
      throw new Error("unknown terminal invitation");
    }
    if (invitation.status !== "pending") {
      throw new Error(`terminal invitation is not pending: ${invitation.status}`);
    }
    if (isManagedInvitationExpired({ expiresAt: invitation.expiresAt })) {
      this.db.updateInvitationStatus(invitation.resourceId, invitation.invitationId, {
        status: "expired",
      });
      throw new Error("terminal invitation expired");
    }
    return invitation;
  }

  private activateManagedSeatPayload(
    terminalId: string,
    participantId: TerminalActorId,
    payload: TerminalManagedSeatPayload,
  ): TerminalAccessProjection {
    const access = this.ensureActorAccess(terminalId, participantId, payload.role, undefined, payload.label);
    if (payload.role === "admin") {
      const nextCandidates = this.mergeAdminCandidate(
        terminalId,
        participantId,
        payload.adminCandidateRank ?? this.readAdminCandidateRank(terminalId, participantId) ?? 0,
      );
      this.db.setAdminGroup(
        terminalId,
        nextCandidates.sort((left, right) => left.priority - right.priority).map((candidate) => candidate.participantId),
      );
    } else {
      const nextCandidates = this.db
        .listAdminCandidates(terminalId)
        .filter((candidate) => candidate.participantId !== participantId)
        .map((candidate) => candidate.participantId);
      this.db.setAdminGroup(terminalId, nextCandidates);
    }
    return access;
  }

  private resolveManagedSeatInviterPrincipalId(
    actorId: TerminalActorId | null,
    superadminActorId?: TerminalActorId,
  ): TerminalInvitationRecord["inviterPrincipalId"] {
    const candidate = (actorId ?? superadminActorId)?.trim();
    if (!candidate || !isPrincipalId(candidate)) {
      throw new Error("terminal managed invitation inviter must resolve to a principal id");
    }
    return candidate;
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

  private resolveReadCursorActorId(input: {
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
    if (input.accessToken) {
      return this.resolveGrant({
        terminalId: input.terminalId,
        accessToken: input.accessToken,
      }).participantId;
    }
    return this.getTrustedBootstrapGrant(input.terminalId)?.participantId;
  }

  private commitReadCursor(terminalId: string, cursor: TerminalReadCursorProjection | null): void {
    if (!cursor?.consumed || !cursor.toHash) {
      return;
    }
    this.db.upsertReadCursor({
      terminalId,
      readerActorId: cursor.readerActorId,
      cursorHash: cursor.toHash,
    });
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

  private buildAwaitResult(input: {
    entry: ManagedEntry;
    input: TerminalAwaitInput;
    snapshot: ManagedTerminalSnapshot;
    outcome: TerminalAwaitOutcome;
    startedAt: number;
    fromHash: string | null;
  }): TerminalAwaitResult {
    const projection = this.describeReadProjection(input.entry.record, input.entry.terminal);
    const viewLines = resolveAwaitViewLines(input.input);
    const lines = resolveAwaitEvidenceLines(input.snapshot.lines, viewLines);
    const match = matchSnapshotLines(input.snapshot.lines, input.input.match);
    return {
      kind: "terminal-await",
      terminalId: input.input.terminalId,
      outcome: input.outcome,
      waitedMs: Math.max(0, Date.now() - input.startedAt),
      fromHash: input.fromHash,
      toHash: String(input.snapshot.seq),
      seq: input.snapshot.seq,
      cols: input.snapshot.cols,
      rows: input.snapshot.rows,
      cursor: input.snapshot.cursor,
      snapshot: {
        seq: input.snapshot.seq,
        timestamp: input.snapshot.timestamp,
        cols: input.snapshot.cols,
        rows: input.snapshot.rows,
        cursor: input.snapshot.cursor,
        lines,
      },
      match: input.input.match
        ? {
            matched: match?.matched ?? false,
            pattern: input.input.match.pattern,
            regex: input.input.match.regex ?? false,
            caseInsensitive: input.input.match.caseInsensitive ?? false,
            matches: match?.matches ?? [],
          }
        : undefined,
      status: projection.status,
      processPhase: projection.processPhase,
      lifecycleTransition: projection.lifecycleTransition ?? null,
      title: projection.title,
      configuredTitle: projection.configuredTitle,
      currentTitle: projection.currentTitle,
      currentPath: projection.currentPath,
      running: projection.running,
    };
  }

  private attachAwaitEvent(payload: TerminalAwaitResult, actorId?: TerminalActorId): TerminalAwaitResult {
    const event = this.db.appendEvent({
      terminalId: payload.terminalId,
      kind: "terminal_read",
      payload: {
        title: "Terminal await",
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

  private finalizeAwaitResult(
    payload: TerminalAwaitResult,
    actorId: TerminalActorId | undefined,
    recordActivity: boolean,
  ): TerminalAwaitResult {
    if (!recordActivity) {
      return {
        ...payload,
        recordedActivity: false,
      };
    }
    return this.attachAwaitEvent(payload, actorId);
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
