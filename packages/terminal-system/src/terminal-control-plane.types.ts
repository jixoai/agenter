import type { PrincipalId } from "@agenter/principal-crypto";
import type {
  ManagedInvitationAcceptProof,
  ManagedInvitationEndpointDescriptor,
  ManagedInvitationRecordBase,
  ManagedInvitationShareDescriptor,
} from "@agenter/managed-seat-invitation-handshake";
import type { ManagedTerminalSnapshot } from "./managed-terminal";
import type { TerminalDirtySliceResult, TerminalGitLogMode, TerminalLogStyle, TerminalStatus } from "./types";
import type {
  TerminalLifecycleState,
  TerminalLifecycleTransition,
  TerminalObservedIdentity,
  TerminalProcessPhase,
} from "./terminal-runtime-truth";

export type TerminalFocusOp = "add" | "remove" | "replace" | "clear";
export type TerminalReadMode = "auto" | "diff" | "snapshot";
export type TerminalAwaitUntil = "changed" | "idle" | "match" | "absent";
export type TerminalAwaitOutcome = "changed" | "idle" | "matched" | "absent" | "timeout" | "stopped" | "cancelled";
export type TerminalGrantRole = "admin" | "writer" | "requester" | "readonly";
export type TerminalManagedSeatClass = "RO" | "RW" | "TM";
export type TerminalApprovalStatus = "pending" | "approved" | "denied" | "expired";
export type TerminalRendererPreference = "auto" | "ghostty-web" | "wterm" | "xterm";
export type TerminalResolvedRenderer = "ghostty-web" | "wterm" | "xterm";
export type TerminalThemeName = "default-dark" | "default-light" | "monokai";
export type TerminalCursorStyle = "block" | "bar" | "underline";
export type TerminalActorId = PrincipalId | `${"auth" | "session" | "system"}:${string}`;
export type TerminalEventKind = "terminal_read" | "terminal_write" | "terminal_resize";
export type TerminalAutomationInputMode = "raw" | "mixed";

export const DEFAULT_TERMINAL_RENDERER_PREFERENCE = "auto" as const satisfies TerminalRendererPreference;
export const DEFAULT_TERMINAL_THEME = "default-dark" as const satisfies TerminalThemeName;
export const DEFAULT_TERMINAL_CURSOR = "block" as const satisfies TerminalCursorStyle;

export interface TerminalFontProfile {
  family: string;
  sizePx: number;
  lineHeight: number;
  letterSpacing: number;
  weight: string;
  weightBold: string;
  ligatures: boolean;
}

export const DEFAULT_TERMINAL_FONT: Readonly<TerminalFontProfile> = {
  family:
    "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sizePx: 14,
  lineHeight: 1,
  letterSpacing: 0,
  weight: "400",
  weightBold: "700",
  ligatures: true,
} as const satisfies TerminalFontProfile;

export interface TerminalReverseCursor {
  beforeTimeMs: number;
  beforeId: number;
}

export interface TerminalReversePage<T> {
  items: T[];
  nextBefore: TerminalReverseCursor | null;
  hasMoreBefore: boolean;
}

export interface TerminalShortcutMap {
  [action: string]: string;
}

export interface TerminalProcessProfile {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  gitLog?: false | TerminalGitLogMode;
  logStyle?: TerminalLogStyle;
  icon?: string;
  title?: string;
  shortcuts?: TerminalShortcutMap;
  rendererPreference?: TerminalRendererPreference;
  theme?: TerminalThemeName;
  cursor?: TerminalCursorStyle;
  font?: TerminalFontProfile;
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
  approvalTimeoutMs?: number;
}

export interface TerminalControlPlaneConfigPatch {
  defaults?: TerminalProcessProfile;
  processProfiles?: Record<string, TerminalProcessProfile>;
  terminalProfiles?: Record<string, TerminalProcessProfile>;
  transport?: Partial<TerminalTransportConfig>;
  approvalTimeoutMs?: number;
}

export interface TerminalCreateInput {
  terminalId?: string;
  processKind?: string;
  command?: string[];
  cwd?: string;
  profile?: TerminalProcessProfile;
  metadata?: Record<string, unknown>;
  start?: boolean;
  bootstrapActorId?: TerminalActorId;
  bootstrapRole?: TerminalGrantRole;
  bootstrapAccessToken?: string;
  adminGroupCandidateIds?: TerminalActorId[];
}

export interface TerminalWriteInput {
  terminalId: string;
  text: string;
  returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  readRecordActivity?: boolean;
  readMode?: TerminalReadMode;
  actorId?: TerminalActorId;
  accessToken?: string;
  superadminActorId?: TerminalActorId;
  createApprovalRequest?: boolean;
}

export interface TerminalInputInput {
  terminalId: string;
  text: string;
  returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  readRecordActivity?: boolean;
  readMode?: TerminalReadMode;
  actorId?: TerminalActorId;
  accessToken?: string;
  superadminActorId?: TerminalActorId;
  createApprovalRequest?: boolean;
}

export interface TerminalReadResult {
  kind: "terminal-diff" | "terminal-snapshot";
  representation: "diff" | "snapshot";
  terminalId: string;
  eventId?: number;
  recordedActivity?: boolean;
  fromHash?: string | null;
  toHash?: string | null;
  seq?: number;
  cols?: number;
  rows?: number;
  cursor?: { x: number; y: number };
  tail?: string;
  snapshot?: ManagedTerminalSnapshot;
  diff?: string;
  bytes?: number;
  status: "IDLE" | "BUSY";
  processPhase: TerminalProcessPhase;
  lifecycleTransition?: TerminalLifecycleTransition | null;
  title?: string;
  configuredTitle?: string;
  currentTitle?: string;
  currentPath?: string;
  running?: boolean;
  readCursor?: {
    readerActorId: TerminalActorId;
    fromHash: string | null;
    toHash: string | null;
    consumed: boolean;
  };
}

export interface TerminalAwaitWaitOptions {
  until?: TerminalAwaitUntil;
  fromHash?: string | null;
  timeoutMs?: number;
  idleMs?: number;
}

export interface TerminalAwaitMatchOptions {
  pattern: string;
  regex?: boolean;
  caseInsensitive?: boolean;
  contextLines?: number;
}

export interface TerminalAwaitViewOptions {
  type?: "tail";
  lines?: number;
}

export interface TerminalAwaitInput {
  terminalId: string;
  wait?: TerminalAwaitWaitOptions;
  match?: TerminalAwaitMatchOptions;
  view?: TerminalAwaitViewOptions;
  recordActivity?: boolean;
  actorId?: TerminalActorId;
  accessToken?: string;
  superadminActorId?: TerminalActorId;
  signal?: AbortSignal;
}

export interface TerminalAwaitMatchEvidence {
  lineIndex: number;
  text: string;
  matchedText: string;
  contextLines: string[];
}

export interface TerminalAwaitResult {
  kind: "terminal-await";
  terminalId: string;
  outcome: TerminalAwaitOutcome;
  eventId?: number;
  recordedActivity?: boolean;
  waitedMs: number;
  fromHash: string | null;
  toHash: string | null;
  seq: number;
  cols: number;
  rows: number;
  cursor: { x: number; y: number };
  snapshot: {
    seq: number;
    timestamp: number;
    cols: number;
    rows: number;
    cursor: { x: number; y: number };
    lines: string[];
  };
  match?: {
    matched: boolean;
    pattern?: string;
    regex?: boolean;
    caseInsensitive?: boolean;
    matches: TerminalAwaitMatchEvidence[];
  };
  status: "IDLE" | "BUSY";
  processPhase: TerminalProcessPhase;
  lifecycleTransition?: TerminalLifecycleTransition | null;
  title?: string;
  configuredTitle?: string;
  currentTitle?: string;
  currentPath?: string;
  running?: boolean;
}

export interface TerminalTransportEndpoint {
  host: string;
  port: number;
  path: string;
  url: string;
}

export interface TerminalGrantRecord {
  grantId: string;
  terminalId: string;
  role: TerminalGrantRole;
  label?: string;
  participantId?: TerminalActorId;
  accessToken?: string;
  createdAt: number;
  revokedAt?: number;
}

export interface TerminalSeatProjection {
  actorId: TerminalActorId;
  role: TerminalGrantRole;
  label?: string;
  currentAdmin: boolean;
  adminCandidateRank?: number;
  online: boolean;
  focused: boolean;
  invalidCredential?: boolean;
  leaseId?: string;
  leaseExpiresAt?: number;
}

export interface TerminalAccessProjection {
  role: TerminalGrantRole;
  accessToken: string;
  participantId?: TerminalActorId;
  currentAdmin: boolean;
  adminCandidateRank?: number;
  leaseId?: string;
  leaseExpiresAt?: number;
}

export interface TerminalApprovalRequestRecord {
  requestId: string;
  terminalId: string;
  participantId: TerminalActorId;
  assignedAdminId?: TerminalActorId;
  createdAt: number;
  expiresAt: number;
  status: TerminalApprovalStatus;
  requestedInput?: {
    mode: TerminalAutomationInputMode;
    text: string;
  };
  decidedAt?: number;
  decidedBy?: TerminalActorId;
  leaseId?: string;
}

export interface TerminalWriteLeaseRecord {
  leaseId: string;
  terminalId: string;
  participantId: TerminalActorId;
  grantedBy?: TerminalActorId;
  requestId?: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
}

export interface TerminalGrantWriteLeaseInput {
  terminalId: string;
  participantId: TerminalActorId;
  durationMs: number;
  actorId?: TerminalActorId;
  superadminActorId?: TerminalActorId;
}

export interface TerminalRevokeWriteLeaseInput {
  terminalId: string;
  leaseId?: string;
  participantId?: TerminalActorId;
  actorId?: TerminalActorId;
  superadminActorId?: TerminalActorId;
}

export interface TerminalReadCursorRecord {
  terminalId: string;
  readerActorId: TerminalActorId;
  cursorHash: string | null;
  updatedAt: number;
}

export interface TerminalEventPayload {
  title: string;
  content: string;
  actorId?: TerminalActorId;
  detail?: unknown;
}

export interface TerminalEventRecord {
  eventId: number;
  terminalId: string;
  kind: TerminalEventKind;
  createdAt: number;
  payload: TerminalEventPayload;
}

export interface TerminalIssueGrantInput {
  participantId: TerminalActorId;
  role: TerminalGrantRole;
  label?: string;
  accessTokenHint?: string;
  adminCandidateRank?: number | null;
}

export interface TerminalManagedSeatPayload {
  seatClass: TerminalManagedSeatClass;
  role: Exclude<TerminalGrantRole, "requester">;
  label?: string;
  adminCandidateRank?: number | null;
}

export interface TerminalInvitationRecord extends ManagedInvitationRecordBase<TerminalManagedSeatPayload> {
  resourceKind: "terminal";
  resourceId: string;
  descriptor: ManagedInvitationShareDescriptor & {
    resourceKind: "terminal";
  };
}

export interface TerminalInviteSeatInput {
  terminalId: string;
  participantId: PrincipalId;
  seatClass: TerminalManagedSeatClass;
  label?: string;
  expiresAt?: number;
  endpoint?: ManagedInvitationEndpointDescriptor;
  accessToken?: string;
  actorId?: TerminalActorId;
  superadminActorId?: TerminalActorId;
}

export interface TerminalAcceptSeatInput {
  descriptor: string;
  proof: ManagedInvitationAcceptProof;
}

export interface TerminalConfigSeatInput {
  terminalId: string;
  participantId: PrincipalId;
  seatClass: TerminalManagedSeatClass;
  label?: string;
  expiresAt?: number;
  endpoint?: ManagedInvitationEndpointDescriptor;
  accessToken?: string;
  actorId?: TerminalActorId;
  superadminActorId?: TerminalActorId;
}

export interface TerminalRevokeSeatInput {
  terminalId: string;
  participantId: PrincipalId;
  accessToken?: string;
  actorId?: TerminalActorId;
  superadminActorId?: TerminalActorId;
}

export interface TerminalIssuedGrant extends TerminalGrantRecord {
  accessToken: string;
  currentAdmin: boolean;
  adminCandidateRank?: number;
}

export interface TerminalControlPlaneEntry {
  terminalId: string;
  processKind: string;
  command: string[];
  launchCwd: string;
  workspace: string | null;
  status: "IDLE" | "BUSY";
  lifecycleTransition?: TerminalLifecycleTransition | null;
  seq: number;
  snapshot?: ManagedTerminalSnapshot;
  focused: boolean;
  icon?: string;
  configuredTitle?: string;
  shortcuts?: TerminalShortcutMap;
  rendererPreference: TerminalRendererPreference;
  theme: TerminalThemeName;
  cursor: TerminalCursorStyle;
  font: TerminalFontProfile;
  transportUrl?: string;
  currentAdminId?: TerminalActorId | null;
  approvalTimeoutMs?: number;
  pendingRequestCount?: number;
  metadata?: Record<string, unknown>;
  access?: TerminalAccessProjection;
  actors?: TerminalSeatProjection[];
}

export interface TerminalControlPlaneEntry extends TerminalObservedIdentity, TerminalLifecycleState {}

export interface TerminalPatchInput {
  processKind?: string;
  command?: string[];
  launchCwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  gitLog?: false | TerminalGitLogMode;
  logStyle?: TerminalLogStyle;
  title?: string;
  icon?: string;
  shortcuts?: TerminalShortcutMap;
  rendererPreference?: TerminalRendererPreference;
  theme?: TerminalThemeName;
  cursor?: TerminalCursorStyle;
  font?: TerminalFontProfile;
  adminGroupCandidateIds?: TerminalActorId[];
  metadata?: Record<string, unknown>;
}

export interface TerminalConfigView {
  terminalId: string;
  processKind: string;
  command: string[];
  launchCwd: string;
  profile: TerminalProcessProfile;
  metadata: Record<string, unknown>;
  processPhase: TerminalProcessPhase;
  lifecycleTransition?: TerminalLifecycleTransition | null;
}

export interface TerminalConfigMutationResult {
  config: TerminalConfigView;
  appliedLiveFields: string[];
  nextBootstrapFields: string[];
}

export interface TerminalRecord {
  terminalId: string;
  processKind: string;
  command: string[];
  launchCwd: string;
  profile: TerminalProcessProfile;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TerminalRecord extends TerminalLifecycleState {}

export interface TerminalAdminCandidateRecord {
  terminalId: string;
  participantId: TerminalActorId;
  priority: number;
}

export interface TerminalWriteResult {
  ok: boolean;
  message: string;
  eventId?: number;
  leaseId?: string;
  read?: TerminalReadResult;
  approvalRequest?: TerminalApprovalRequestRecord;
}

export interface TerminalPolicyDecision {
  ok: boolean;
  grant?: TerminalGrantRecord;
  lease?: TerminalWriteLeaseRecord | null;
  message?: string;
}

export interface TerminalReadProjection {
  status: TerminalStatus;
  processPhase: TerminalProcessPhase;
  lifecycleTransition?: TerminalLifecycleTransition | null;
  title?: string;
  configuredTitle?: string;
  currentTitle?: string;
  currentPath?: string;
  running: boolean;
}

export type TerminalSerializedReadDiff = TerminalDirtySliceResult;
