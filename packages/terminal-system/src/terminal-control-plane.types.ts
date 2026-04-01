import type { ManagedTerminalSnapshot } from "./managed-terminal";
import type { TerminalDirtySliceResult, TerminalGitLogMode, TerminalLogStyle, TerminalStatus } from "./types";

export type TerminalFocusOp = "add" | "remove" | "replace" | "clear";
export type TerminalReadMode = "auto" | "diff" | "snapshot";
export type TerminalGrantRole = "admin" | "writer" | "requester" | "readonly";
export type TerminalApprovalStatus = "pending" | "approved" | "denied" | "expired";
export type TerminalRendererEngine = "xterm";
export type TerminalActorId = `${"auth" | "session" | "system"}:${string}`;
export type TerminalEventKind = "terminal_read" | "terminal_write";

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
  cols?: number;
  rows?: number;
  gitLog?: false | TerminalGitLogMode;
  logStyle?: TerminalLogStyle;
  icon?: string;
  title?: string;
  shortcuts?: TerminalShortcutMap;
  rendererEngine?: TerminalRendererEngine;
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
  start?: boolean;
  bootstrapActorId?: TerminalActorId;
  bootstrapRole?: TerminalGrantRole;
  bootstrapAccessToken?: string;
  adminGroupCandidateIds?: TerminalActorId[];
}

export interface TerminalWriteInput {
  terminalId: string;
  text: string;
  submit?: boolean;
  submitKey?: "enter" | "linefeed";
  submitGapMs?: number;
  returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
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
  title?: string;
  running?: boolean;
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
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
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

export interface TerminalIssuedGrant extends TerminalGrantRecord {
  accessToken: string;
  currentAdmin: boolean;
  adminCandidateRank?: number;
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
  snapshot?: ManagedTerminalSnapshot;
  focused: boolean;
  icon?: string;
  title?: string;
  shortcuts?: TerminalShortcutMap;
  rendererEngine?: TerminalRendererEngine;
  transportUrl?: string;
  currentAdminId?: TerminalActorId | null;
  approvalTimeoutMs?: number;
  pendingRequestCount?: number;
  access?: TerminalAccessProjection;
  actors?: TerminalSeatProjection[];
}

export interface TerminalPatchInput {
  title?: string;
  icon?: string;
  shortcuts?: TerminalShortcutMap;
  rendererEngine?: TerminalRendererEngine;
  adminGroupCandidateIds?: TerminalActorId[];
  metadata?: Record<string, unknown>;
}

export interface TerminalRecord {
  terminalId: string;
  processKind: string;
  command: string[];
  cwd: string;
  profile: TerminalProcessProfile;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TerminalAdminCandidateRecord {
  terminalId: string;
  participantId: TerminalActorId;
  priority: number;
}

export interface TerminalWriteResult {
  ok: boolean;
  message: string;
  eventId?: number;
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
  title?: string;
  running: boolean;
}

export type TerminalSerializedReadDiff = TerminalDirtySliceResult;
