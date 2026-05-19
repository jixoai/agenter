import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";
import { DEFAULT_TERMINAL_BACKEND, isTerminalBackendKind } from "@agenter/termless-core";

import type {
  TerminalInvitationRecord,
  TerminalManagedSeatPayload,
  TerminalAdminCandidateRecord,
  TerminalApprovalRequestRecord,
  TerminalApprovalStatus,
  TerminalEventKind,
  TerminalEventPayload,
  TerminalEventRecord,
  TerminalReverseCursor,
  TerminalReversePage,
  TerminalGrantRecord,
  TerminalGrantRole,
  TerminalIssueGrantInput,
  TerminalPatchInput,
  TerminalRecord,
  TerminalReadCursorRecord,
  TerminalWriteLeaseRecord,
} from "./terminal-control-plane.types";
import type { TerminalLifecycleState } from "./terminal-runtime-truth";

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toJson = (value: unknown): string => JSON.stringify(value ?? null);

const resolvePageLimit = (limit: number | undefined, max = 1_000): number => Math.max(1, Math.min(limit ?? 200, max));

const buildNextCursor = <T extends { createdAt: number }>(
  itemsDescending: T[],
  hasMoreBefore: boolean,
  getId: (item: T) => number,
): TerminalReverseCursor | null => {
  if (!hasMoreBefore || itemsDescending.length === 0) {
    return null;
  }
  const oldest = itemsDescending.at(-1);
  if (!oldest) {
    return null;
  }
  return {
    beforeTimeMs: oldest.createdAt,
    beforeId: getId(oldest),
  };
};

const mapTerminal = (row: {
  terminal_id: string;
  process_kind: string;
  backend: string | null;
  command_json: string;
  launch_cwd: string;
  profile_json: string | null;
  metadata_json: string | null;
  process_phase: string | null;
  last_stop_reason: string | null;
  last_exit_code: number | null;
  last_exit_signal: string | null;
  last_stopped_at: number | null;
  created_at: number;
  updated_at: number;
}): TerminalRecord => ({
  terminalId: row.terminal_id,
  processKind: row.process_kind,
  backend: isTerminalBackendKind(row.backend) ? row.backend : DEFAULT_TERMINAL_BACKEND,
  command: parseJson<string[]>(row.command_json, []),
  launchCwd: row.launch_cwd,
  profile: parseJson(row.profile_json, {}),
  metadata: parseJson(row.metadata_json, {}),
  processPhase:
    row.process_phase === "running" || row.process_phase === "stopped" ? row.process_phase : "not_started",
  lastStopReason:
    row.last_stop_reason === "killed" || row.last_stop_reason === "exited" || row.last_stop_reason === "startup_failed"
      ? row.last_stop_reason
      : null,
  lastExitCode: row.last_exit_code ?? null,
  lastExitSignal: row.last_exit_signal ?? null,
  lastStoppedAt: row.last_stopped_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeGrantRole = (value: string | null): TerminalGrantRole => {
  switch (value) {
    case "admin":
    case "writer":
    case "guard":
      return value;
    case "requester":
      return "guard";
    default:
      return "readonly";
  }
};

const mapGrant = (row: {
  grant_id: string;
  terminal_id: string;
  role: string;
  label: string | null;
  participant_id: string | null;
  access_token: string | null;
  created_at: number;
  revoked_at: number | null;
}): TerminalGrantRecord => ({
  grantId: row.grant_id,
  terminalId: row.terminal_id,
  role: normalizeGrantRole(row.role),
  label: row.label ?? undefined,
  participantId: (row.participant_id ?? undefined) as TerminalGrantRecord["participantId"],
  accessToken: row.access_token ?? undefined,
  createdAt: row.created_at,
  revokedAt: row.revoked_at ?? undefined,
});

const normalizeApprovalStatus = (value: string | null): TerminalApprovalStatus => {
  switch (value) {
    case "approved":
    case "denied":
    case "expired":
      return value;
    default:
      return "pending";
  }
};

const mapApprovalRequest = (row: {
  request_id: string;
  terminal_id: string;
  participant_id: string;
  assigned_admin_id: string | null;
  created_at: number;
  expires_at: number;
  status: string | null;
  requested_input_json: string | null;
  decided_at: number | null;
  decided_by: string | null;
  lease_id: string | null;
}): TerminalApprovalRequestRecord => ({
  requestId: row.request_id,
  terminalId: row.terminal_id,
  participantId: row.participant_id as TerminalApprovalRequestRecord["participantId"],
  assignedAdminId: (row.assigned_admin_id ?? undefined) as TerminalApprovalRequestRecord["assignedAdminId"],
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  status: normalizeApprovalStatus(row.status),
  requestedInput: parseJson(row.requested_input_json, undefined),
  decidedAt: row.decided_at ?? undefined,
  decidedBy: (row.decided_by ?? undefined) as TerminalApprovalRequestRecord["decidedBy"],
  leaseId: row.lease_id ?? undefined,
});

const mapLease = (row: {
  lease_id: string;
  terminal_id: string;
  participant_id: string;
  granted_by: string | null;
  request_id: string | null;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
}): TerminalWriteLeaseRecord => ({
  leaseId: row.lease_id,
  terminalId: row.terminal_id,
  participantId: row.participant_id as TerminalWriteLeaseRecord["participantId"],
  grantedBy: (row.granted_by ?? undefined) as TerminalWriteLeaseRecord["grantedBy"],
  requestId: row.request_id ?? undefined,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at ?? undefined,
});

const mapAdminCandidate = (row: {
  terminal_id: string;
  participant_id: string;
  priority: number;
}): TerminalAdminCandidateRecord => ({
  terminalId: row.terminal_id,
  participantId: row.participant_id as TerminalAdminCandidateRecord["participantId"],
  priority: row.priority,
});

const normalizeInvitationStatus = (value: string | null): TerminalInvitationRecord["status"] => {
  switch (value) {
    case "accepted":
    case "revoked":
    case "expired":
      return value;
    default:
      return "pending";
  }
};

const mapInvitation = (row: {
  invitation_id: string;
  terminal_id: string;
  inviter_participant_id: string;
  invitee_participant_id: string;
  native_payload_json: string;
  payload_digest: string;
  acceptance_token_hash: string;
  descriptor_json: string;
  status: string | null;
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  revoked_at: number | null;
  superseded_by_invitation_id: string | null;
}): TerminalInvitationRecord => ({
  invitationId: row.invitation_id,
  resourceKind: "terminal",
  resourceId: row.terminal_id,
  inviterPrincipalId: row.inviter_participant_id as TerminalInvitationRecord["inviterPrincipalId"],
  inviteePrincipalId: row.invitee_participant_id as TerminalInvitationRecord["inviteePrincipalId"],
  payload: parseJson<TerminalManagedSeatPayload>(row.native_payload_json, {
    seatClass: "RO",
    role: "readonly",
  }),
  payloadDigest: row.payload_digest,
  tokenHash: row.acceptance_token_hash,
  descriptor: parseJson<TerminalInvitationRecord["descriptor"]>(row.descriptor_json, {
    resourceKind: "terminal",
    token: "",
    deepLink: "",
  }),
  status: normalizeInvitationStatus(row.status),
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at ?? undefined,
  revokedAt: row.revoked_at ?? undefined,
  supersededByInvitationId: row.superseded_by_invitation_id ?? undefined,
});

const mapEvent = (row: {
  event_id: number;
  terminal_id: string;
  kind: string;
  created_at: number;
  payload_json: string | null;
}): TerminalEventRecord => ({
  eventId: row.event_id,
  terminalId: row.terminal_id,
  kind:
    row.kind === "terminal_write"
      ? "terminal_write"
      : row.kind === "terminal_resize"
        ? "terminal_resize"
        : "terminal_read",
  createdAt: row.created_at,
  payload: parseJson<TerminalEventPayload>(row.payload_json, { title: row.kind, content: "" }),
});

const mapReadCursor = (row: {
  terminal_id: string;
  reader_actor_id: string;
  cursor_hash: string | null;
  updated_at: number;
}): TerminalReadCursorRecord => ({
  terminalId: row.terminal_id,
  readerActorId: row.reader_actor_id as TerminalReadCursorRecord["readerActorId"],
  cursorHash: row.cursor_hash ?? null,
  updatedAt: row.updated_at,
});

export class TerminalDb {
  private readonly db: Database;
  private hasLegacyCwdColumn = false;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  createTerminal(input: Omit<TerminalRecord, "createdAt" | "updatedAt">): TerminalRecord {
    this.purgeRemovedTerminal(input.terminalId);
    const now = Date.now();
    if (this.hasLegacyCwdColumn) {
      this.db
        .query(
          `insert into terminal_catalog (
            terminal_id, process_kind, backend, command_json, cwd, launch_cwd, profile_json, metadata_json,
            process_phase, last_stop_reason, last_exit_code, last_exit_signal, last_stopped_at,
            created_at, updated_at, removed_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)`,
        )
        .run(
          input.terminalId,
          input.processKind,
          input.backend,
          toJson(input.command),
          input.launchCwd,
          input.launchCwd,
          toJson(input.profile),
          toJson(input.metadata),
          input.processPhase,
          input.lastStopReason ?? null,
          input.lastExitCode ?? null,
          input.lastExitSignal ?? null,
          input.lastStoppedAt ?? null,
          now,
          now,
        );
    } else {
      this.db
        .query(
          `insert into terminal_catalog (
            terminal_id, process_kind, backend, command_json, launch_cwd, profile_json, metadata_json,
            process_phase, last_stop_reason, last_exit_code, last_exit_signal, last_stopped_at,
            created_at, updated_at, removed_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)`,
        )
        .run(
          input.terminalId,
          input.processKind,
          input.backend,
          toJson(input.command),
          input.launchCwd,
          toJson(input.profile),
          toJson(input.metadata),
          input.processPhase,
          input.lastStopReason ?? null,
          input.lastExitCode ?? null,
          input.lastExitSignal ?? null,
          input.lastStoppedAt ?? null,
          now,
          now,
        );
    }
    return this.getTerminal(input.terminalId)!;
  }

  getTerminal(terminalId: string): TerminalRecord | undefined {
    const row = this.db
      .query(
        `select terminal_id, process_kind, command_json, launch_cwd, profile_json, metadata_json,
                backend,
                process_phase, last_stop_reason, last_exit_code, last_exit_signal, last_stopped_at,
                created_at, updated_at
         from terminal_catalog
         where terminal_id = ? and removed_at is null`,
      )
      .get(terminalId) as Parameters<typeof mapTerminal>[0] | null;
    return row ? mapTerminal(row) : undefined;
  }

  listTerminals(): TerminalRecord[] {
    const rows = this.db
      .query(
        `select terminal_id, process_kind, command_json, launch_cwd, profile_json, metadata_json,
                backend,
                process_phase, last_stop_reason, last_exit_code, last_exit_signal, last_stopped_at,
                created_at, updated_at
         from terminal_catalog
         where removed_at is null
         order by updated_at desc, terminal_id asc`,
      )
      .all() as Array<Parameters<typeof mapTerminal>[0]>;
    return rows.map(mapTerminal);
  }

  updateTerminal(
    terminalId: string,
    patch: TerminalPatchInput,
  ): TerminalRecord {
    const current = this.getTerminal(terminalId);
    if (!current) {
      throw new Error(`unknown terminal: ${terminalId}`);
    }
    const now = Date.now();
    const nextProfile = {
      ...current.profile,
      ...(patch.env !== undefined ? { env: patch.env } : {}),
      ...(patch.cols !== undefined ? { cols: patch.cols } : {}),
      ...(patch.rows !== undefined ? { rows: patch.rows } : {}),
      ...(patch.gitLog !== undefined ? { gitLog: patch.gitLog } : {}),
      ...(patch.logStyle !== undefined ? { logStyle: patch.logStyle } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.shortcuts !== undefined ? { shortcuts: patch.shortcuts } : {}),
      ...(patch.rendererPreference !== undefined ? { rendererPreference: patch.rendererPreference } : {}),
      ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      ...(patch.cursor !== undefined ? { cursor: patch.cursor } : {}),
      ...(patch.font !== undefined ? { font: patch.font } : {}),
    };
    const nextMetadata = {
      ...current.metadata,
      ...(patch.metadata ?? {}),
    };
    const nextLaunchCwd = patch.launchCwd ?? current.launchCwd;
    if (this.hasLegacyCwdColumn) {
      this.db
        .query(
          `update terminal_catalog
           set process_kind = ?, backend = ?, command_json = ?, cwd = ?, launch_cwd = ?, profile_json = ?, metadata_json = ?, updated_at = ?
           where terminal_id = ? and removed_at is null`,
        )
        .run(
          patch.processKind ?? current.processKind,
          patch.backend ?? current.backend,
          toJson(patch.command ?? current.command),
          nextLaunchCwd,
          nextLaunchCwd,
          toJson(nextProfile),
          toJson(nextMetadata),
          now,
          terminalId,
        );
    } else {
      this.db
        .query(
          `update terminal_catalog
           set process_kind = ?, backend = ?, command_json = ?, launch_cwd = ?, profile_json = ?, metadata_json = ?, updated_at = ?
           where terminal_id = ? and removed_at is null`,
        )
        .run(
          patch.processKind ?? current.processKind,
          patch.backend ?? current.backend,
          toJson(patch.command ?? current.command),
          nextLaunchCwd,
          toJson(nextProfile),
          toJson(nextMetadata),
          now,
          terminalId,
        );
    }
    return this.getTerminal(terminalId)!;
  }

  updateLifecycle(terminalId: string, patch: Partial<TerminalLifecycleState>): TerminalRecord {
    const current = this.getTerminal(terminalId);
    if (!current) {
      throw new Error(`unknown terminal: ${terminalId}`);
    }
    const now = Date.now();
    this.db
      .query(
        `update terminal_catalog
         set process_phase = ?,
             last_stop_reason = ?,
             last_exit_code = ?,
             last_exit_signal = ?,
             last_stopped_at = ?,
             updated_at = ?
         where terminal_id = ? and removed_at is null`,
      )
      .run(
        patch.processPhase ?? current.processPhase,
        patch.lastStopReason === undefined ? current.lastStopReason ?? null : (patch.lastStopReason ?? null),
        patch.lastExitCode === undefined ? current.lastExitCode ?? null : (patch.lastExitCode ?? null),
        patch.lastExitSignal === undefined ? current.lastExitSignal ?? null : (patch.lastExitSignal ?? null),
        patch.lastStoppedAt === undefined ? current.lastStoppedAt ?? null : (patch.lastStoppedAt ?? null),
        now,
        terminalId,
      );
    return this.getTerminal(terminalId)!;
  }

  removeTerminal(terminalId: string): boolean {
    const result = this.db
      .query(`update terminal_catalog set removed_at = ?, updated_at = ? where terminal_id = ? and removed_at is null`)
      .run(Date.now(), Date.now(), terminalId);
    const removed = Number(result.changes) > 0;
    if (removed) {
      this.deleteTerminalDependents(terminalId);
    }
    return removed;
  }

  issueGrant(input: TerminalIssueGrantInput & { terminalId: string; accessToken: string; tokenHash: string }): TerminalGrantRecord {
    const createdAt = Date.now();
    const grantId = `term-grant-${randomUUID()}`;
    this.db
      .query(
        `insert into terminal_grant (
          grant_id, terminal_id, role, label, participant_id, access_token, token_hash, created_at, revoked_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        grantId,
        input.terminalId,
        input.role,
        input.label ?? null,
        input.participantId,
        input.accessToken,
        input.tokenHash,
        createdAt,
      );
    return this.getGrantById(input.terminalId, grantId)!;
  }

  getGrantById(terminalId: string, grantId: string): TerminalGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, terminal_id, role, label, participant_id, access_token, created_at, revoked_at
         from terminal_grant
         where terminal_id = ? and grant_id = ?`,
      )
      .get(terminalId, grantId) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  findReusableGrant(input: { terminalId: string; participantId: string; role: TerminalGrantRole }): TerminalGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, terminal_id, role, label, participant_id, access_token, created_at, revoked_at
         from terminal_grant
         where terminal_id = ?
           and participant_id = ?
           and role = ?
           and revoked_at is null
         order by created_at desc, grant_id desc
         limit 1`,
      )
      .get(input.terminalId, input.participantId, input.role) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  findActiveGrantByToken(terminalId: string, accessToken: string, tokenHash: string): TerminalGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, terminal_id, role, label, participant_id, access_token, created_at, revoked_at
         from terminal_grant
         where terminal_id = ?
           and revoked_at is null
           and (access_token = ? or token_hash = ?)
         order by created_at desc, grant_id desc
         limit 1`,
      )
      .get(terminalId, accessToken, tokenHash) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  listActiveGrants(terminalId: string): TerminalGrantRecord[] {
    const rows = this.db
      .query(
        `select grant_id, terminal_id, role, label, participant_id, access_token, created_at, revoked_at
         from terminal_grant
         where terminal_id = ?
           and revoked_at is null
         order by created_at desc, grant_id desc`,
      )
      .all(terminalId) as Array<Parameters<typeof mapGrant>[0]>;
    return rows.map(mapGrant);
  }

  revokeActiveGrantsByParticipant(terminalId: string, participantId: string): void {
    const now = Date.now();
    this.db
      .query(
        `update terminal_grant
         set revoked_at = ?
         where terminal_id = ?
           and participant_id = ?
           and revoked_at is null`,
      )
      .run(now, terminalId, participantId);
  }

  revokeGrant(terminalId: string, grantId: string): boolean {
    const result = this.db
      .query(`update terminal_grant set revoked_at = ? where terminal_id = ? and grant_id = ? and revoked_at is null`)
      .run(Date.now(), terminalId, grantId);
    return Number(result.changes) > 0;
  }

  upsertInvitation(input: {
    invitationId: string;
    terminalId: string;
    inviterParticipantId: string;
    inviteeParticipantId: string;
    nativePayload: TerminalManagedSeatPayload;
    payloadDigest: string;
    acceptanceTokenHash: string;
    descriptor: TerminalInvitationRecord["descriptor"];
    expiresAt: number;
    supersededByInvitationId?: string | null;
  }): TerminalInvitationRecord {
    const now = Date.now();
    this.db
      .query(
        `insert into terminal_invitation (
          invitation_id,
          terminal_id,
          inviter_participant_id,
          invitee_participant_id,
          native_payload_json,
          payload_digest,
          acceptance_token_hash,
          descriptor_json,
          status,
          created_at,
          expires_at,
          accepted_at,
          revoked_at,
          superseded_by_invitation_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, null, null, ?)`,
      )
      .run(
        input.invitationId,
        input.terminalId,
        input.inviterParticipantId,
        input.inviteeParticipantId,
        toJson(input.nativePayload),
        input.payloadDigest,
        input.acceptanceTokenHash,
        toJson(input.descriptor),
        now,
        input.expiresAt,
        input.supersededByInvitationId ?? null,
      );
    return this.getInvitationById(input.terminalId, input.invitationId)!;
  }

  getInvitationById(terminalId: string, invitationId: string): TerminalInvitationRecord | undefined {
    const row = this.db
      .query(
        `select invitation_id, terminal_id, inviter_participant_id, invitee_participant_id, native_payload_json,
                payload_digest, acceptance_token_hash, descriptor_json, status, created_at, expires_at,
                accepted_at, revoked_at, superseded_by_invitation_id
         from terminal_invitation
         where terminal_id = ? and invitation_id = ?`,
      )
      .get(terminalId, invitationId) as Parameters<typeof mapInvitation>[0] | null;
    return row ? mapInvitation(row) : undefined;
  }

  findLatestInvitationForParticipant(input: {
    terminalId: string;
    inviteeParticipantId: string;
    includeNonPending?: boolean;
  }): TerminalInvitationRecord | undefined {
    const row = this.db
      .query(
        `select invitation_id, terminal_id, inviter_participant_id, invitee_participant_id, native_payload_json,
                payload_digest, acceptance_token_hash, descriptor_json, status, created_at, expires_at,
                accepted_at, revoked_at, superseded_by_invitation_id
         from terminal_invitation
         where terminal_id = ?
           and invitee_participant_id = ?
           and (? = 1 or status = 'pending')
         order by created_at desc, invitation_id desc
         limit 1`,
      )
      .get(
        input.terminalId,
        input.inviteeParticipantId,
        input.includeNonPending ? 1 : 0,
      ) as Parameters<typeof mapInvitation>[0] | null;
    return row ? mapInvitation(row) : undefined;
  }

  findInvitationByTokenHash(acceptanceTokenHash: string): TerminalInvitationRecord | undefined {
    const row = this.db
      .query(
        `select invitation_id, terminal_id, inviter_participant_id, invitee_participant_id, native_payload_json,
                payload_digest, acceptance_token_hash, descriptor_json, status, created_at, expires_at,
                accepted_at, revoked_at, superseded_by_invitation_id
         from terminal_invitation
         where acceptance_token_hash = ?
         order by created_at desc, invitation_id desc
         limit 1`,
      )
      .get(acceptanceTokenHash) as Parameters<typeof mapInvitation>[0] | null;
    return row ? mapInvitation(row) : undefined;
  }

  listInvitations(terminalId: string, input: { statuses?: TerminalInvitationRecord["status"][] } = {}): TerminalInvitationRecord[] {
    const clauses = ["terminal_id = ?"];
    const values: Array<string> = [terminalId];
    if ((input.statuses?.length ?? 0) > 0) {
      const placeholders = input.statuses!.map(() => "?").join(", ");
      clauses.push(`status in (${placeholders})`);
      values.push(...input.statuses!);
    }
    const rows = this.db
      .query(
        `select invitation_id, terminal_id, inviter_participant_id, invitee_participant_id, native_payload_json,
                payload_digest, acceptance_token_hash, descriptor_json, status, created_at, expires_at,
                accepted_at, revoked_at, superseded_by_invitation_id
         from terminal_invitation
         where ${clauses.join(" and ")}
         order by created_at desc, invitation_id desc`,
      )
      .all(...values) as Array<Parameters<typeof mapInvitation>[0]>;
    return rows.map(mapInvitation);
  }

  updateInvitationStatus(
    terminalId: string,
    invitationId: string,
    patch: {
      status?: TerminalInvitationRecord["status"];
      acceptedAt?: number | null;
      revokedAt?: number | null;
      supersededByInvitationId?: string | null;
    },
  ): TerminalInvitationRecord {
    const current = this.getInvitationById(terminalId, invitationId);
    if (!current) {
      throw new Error(`unknown terminal invitation: ${invitationId}`);
    }
    this.db
      .query(
        `update terminal_invitation
         set status = ?,
             accepted_at = ?,
             revoked_at = ?,
             superseded_by_invitation_id = ?
         where terminal_id = ? and invitation_id = ?`,
      )
      .run(
        patch.status ?? current.status,
        patch.acceptedAt === undefined ? current.acceptedAt ?? null : patch.acceptedAt,
        patch.revokedAt === undefined ? current.revokedAt ?? null : patch.revokedAt,
        patch.supersededByInvitationId === undefined
          ? current.supersededByInvitationId ?? null
          : patch.supersededByInvitationId,
        terminalId,
        invitationId,
      );
    return this.getInvitationById(terminalId, invitationId)!;
  }

  revokePendingInvitationsByParticipant(terminalId: string, participantId: string, revokedAt = Date.now()): void {
    this.db
      .query(
        `update terminal_invitation
         set status = 'revoked',
             revoked_at = coalesce(revoked_at, ?)
         where terminal_id = ?
           and invitee_participant_id = ?
           and status = 'pending'`,
      )
      .run(revokedAt, terminalId, participantId);
  }

  expirePendingInvitations(now = Date.now()): void {
    this.db
      .query(
        `update terminal_invitation
         set status = 'expired'
         where status = 'pending'
           and expires_at <= ?`,
      )
      .run(now);
  }

  setAdminGroup(terminalId: string, participantIds: string[]): TerminalAdminCandidateRecord[] {
    const current = this.listAdminCandidates(terminalId);
    const nextSet = new Set(participantIds);
    for (const candidate of current) {
      if (nextSet.has(candidate.participantId)) {
        continue;
      }
      this.db
        .query(`delete from terminal_admin_candidate where terminal_id = ? and participant_id = ?`)
        .run(terminalId, candidate.participantId);
    }
    participantIds.forEach((participantId, priority) => {
      this.db
        .query(
          `insert into terminal_admin_candidate (terminal_id, participant_id, priority)
           values (?, ?, ?)
           on conflict(terminal_id, participant_id) do update set priority = excluded.priority`,
        )
        .run(terminalId, participantId, priority);
    });
    return this.listAdminCandidates(terminalId);
  }

  listAdminCandidates(terminalId: string): TerminalAdminCandidateRecord[] {
    const rows = this.db
      .query(
        `select terminal_id, participant_id, priority
         from terminal_admin_candidate
         where terminal_id = ?
         order by priority asc, participant_id asc`,
      )
      .all(terminalId) as Array<Parameters<typeof mapAdminCandidate>[0]>;
    return rows.map(mapAdminCandidate);
  }

  createApprovalRequest(input: {
    terminalId: string;
    participantId: string;
    assignedAdminId?: string;
    expiresAt: number;
    requestedInput?: TerminalApprovalRequestRecord["requestedInput"];
  }): TerminalApprovalRequestRecord {
    const requestId = `term-request-${randomUUID()}`;
    const createdAt = Date.now();
    this.db
      .query(
        `insert into terminal_approval_request (
          request_id, terminal_id, participant_id, assigned_admin_id, created_at, expires_at, status, requested_input_json, decided_at, decided_by, lease_id
        ) values (?, ?, ?, ?, ?, ?, 'pending', ?, null, null, null)`,
      )
      .run(
        requestId,
        input.terminalId,
        input.participantId,
        input.assignedAdminId ?? null,
        createdAt,
        input.expiresAt,
        toJson(input.requestedInput),
      );
    return this.getApprovalRequest(input.terminalId, requestId)!;
  }

  findEquivalentPendingApprovalRequest(input: {
    terminalId: string;
    participantId: string;
    requestedInput?: TerminalApprovalRequestRecord["requestedInput"];
    now?: number;
  }): TerminalApprovalRequestRecord | undefined {
    const rows = this.listApprovalRequests(input.terminalId, {
      participantId: input.participantId,
      statuses: ["pending"],
    });
    const now = input.now ?? Date.now();
    return rows.find((row) => {
      if (row.expiresAt <= now) {
        return false;
      }
      const left = row.requestedInput;
      const right = input.requestedInput;
      return (left?.mode ?? null) === (right?.mode ?? null) && (left?.text ?? null) === (right?.text ?? null);
    });
  }

  getApprovalRequest(terminalId: string, requestId: string): TerminalApprovalRequestRecord | undefined {
    const row = this.db
      .query(
        `select request_id, terminal_id, participant_id, assigned_admin_id, created_at, expires_at, status, requested_input_json, decided_at, decided_by, lease_id
         from terminal_approval_request
         where terminal_id = ? and request_id = ?`,
      )
      .get(terminalId, requestId) as Parameters<typeof mapApprovalRequest>[0] | null;
    return row ? mapApprovalRequest(row) : undefined;
  }

  listApprovalRequests(
    terminalId: string,
    input: {
      assignedAdminId?: string;
      participantId?: string;
      statuses?: TerminalApprovalStatus[];
    } = {},
  ): TerminalApprovalRequestRecord[] {
    const clauses = ["terminal_id = ?"];
    const values: Array<string> = [terminalId];

    if (input.assignedAdminId !== undefined) {
      clauses.push("assigned_admin_id = ?");
      values.push(input.assignedAdminId);
    }
    if (input.participantId !== undefined) {
      clauses.push("participant_id = ?");
      values.push(input.participantId);
    }
    if ((input.statuses?.length ?? 0) > 0) {
      const placeholders = input.statuses!.map(() => "?").join(", ");
      clauses.push(`status in (${placeholders})`);
      values.push(...input.statuses!);
    }

    const rows = this.db
      .query(
        `select request_id, terminal_id, participant_id, assigned_admin_id, created_at, expires_at, status, requested_input_json, decided_at, decided_by, lease_id
         from terminal_approval_request
         where ${clauses.join(" and ")}
         order by created_at asc, request_id asc`,
      )
      .all(...values) as Array<Parameters<typeof mapApprovalRequest>[0]>;
    return rows.map(mapApprovalRequest);
  }

  listPendingApprovalRequests(terminalId: string): TerminalApprovalRequestRecord[] {
    return this.listApprovalRequests(terminalId, {
      statuses: ["pending"],
    });
  }

  cancelPendingApprovalRequests(terminalId: string, decidedAt = Date.now()): TerminalApprovalRequestRecord[] {
    const cancelled: TerminalApprovalRequestRecord[] = [];
    for (const request of this.listPendingApprovalRequests(terminalId)) {
      cancelled.push(
        this.updateApprovalRequest(terminalId, request.requestId, {
          status: "expired",
          decidedAt,
        }),
      );
    }
    return cancelled;
  }

  updateApprovalRequest(
    terminalId: string,
    requestId: string,
    patch: {
      assignedAdminId?: string | null;
      status?: TerminalApprovalStatus;
      decidedAt?: number | null;
      decidedBy?: string | null;
      leaseId?: string | null;
    },
  ): TerminalApprovalRequestRecord {
    const current = this.getApprovalRequest(terminalId, requestId);
    if (!current) {
      throw new Error(`unknown terminal approval request: ${requestId}`);
    }
    this.db
      .query(
        `update terminal_approval_request
         set assigned_admin_id = ?, status = ?, decided_at = ?, decided_by = ?, lease_id = ?
         where terminal_id = ? and request_id = ?`,
      )
      .run(
        patch.assignedAdminId === undefined ? current.assignedAdminId ?? null : patch.assignedAdminId,
        patch.status ?? current.status,
        patch.decidedAt === undefined ? current.decidedAt ?? null : patch.decidedAt,
        patch.decidedBy === undefined ? current.decidedBy ?? null : patch.decidedBy,
        patch.leaseId === undefined ? current.leaseId ?? null : patch.leaseId,
        terminalId,
        requestId,
      );
    return this.getApprovalRequest(terminalId, requestId)!;
  }

  createWriteLease(input: {
    terminalId: string;
    participantId: string;
    grantedBy?: string;
    requestId?: string;
    expiresAt: number;
  }): TerminalWriteLeaseRecord {
    const leaseId = `term-lease-${randomUUID()}`;
    const createdAt = Date.now();
    this.db
      .query(
        `insert into terminal_write_lease (
          lease_id, terminal_id, participant_id, granted_by, request_id, created_at, expires_at, revoked_at
        ) values (?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        leaseId,
        input.terminalId,
        input.participantId,
        input.grantedBy ?? null,
        input.requestId ?? null,
        createdAt,
        input.expiresAt,
      );
    return this.getWriteLease(input.terminalId, leaseId)!;
  }

  getWriteLease(terminalId: string, leaseId: string): TerminalWriteLeaseRecord | undefined {
    const row = this.db
      .query(
        `select lease_id, terminal_id, participant_id, granted_by, request_id, created_at, expires_at, revoked_at
         from terminal_write_lease
         where terminal_id = ? and lease_id = ?`,
      )
      .get(terminalId, leaseId) as Parameters<typeof mapLease>[0] | null;
    return row ? mapLease(row) : undefined;
  }

  findActiveLease(terminalId: string, participantId: string, now = Date.now()): TerminalWriteLeaseRecord | undefined {
    const row = this.db
      .query(
        `select lease_id, terminal_id, participant_id, granted_by, request_id, created_at, expires_at, revoked_at
         from terminal_write_lease
         where terminal_id = ?
           and participant_id = ?
           and revoked_at is null
           and expires_at > ?
         order by expires_at desc, created_at desc, lease_id desc
         limit 1`,
      )
      .get(terminalId, participantId, now) as Parameters<typeof mapLease>[0] | null;
    return row ? mapLease(row) : undefined;
  }

  revokeActiveLeasesByParticipant(terminalId: string, participantId: string, revokedAt = Date.now()): number {
    const result = this.db
      .query(
        `update terminal_write_lease
         set revoked_at = coalesce(revoked_at, ?)
         where terminal_id = ?
           and participant_id = ?
           and revoked_at is null`,
      )
      .run(revokedAt, terminalId, participantId);
    return Number(result.changes ?? 0);
  }

  revokeWriteLease(terminalId: string, leaseId: string, revokedAt = Date.now()): number {
    const result = this.db
      .query(
        `update terminal_write_lease
         set revoked_at = coalesce(revoked_at, ?)
         where terminal_id = ?
           and lease_id = ?
           and revoked_at is null`,
      )
      .run(revokedAt, terminalId, leaseId);
    return Number(result.changes ?? 0);
  }

  revokeExpiredLeases(now = Date.now()): void {
    this.db
      .query(
        `update terminal_write_lease
         set revoked_at = coalesce(revoked_at, ?)
         where revoked_at is null
           and expires_at <= ?`,
      )
      .run(now, now);
  }

  appendEvent(input: { terminalId: string; kind: TerminalEventKind; createdAt?: number; payload: TerminalEventPayload }): TerminalEventRecord {
    const createdAt = input.createdAt ?? Date.now();
    const result = this.db
      .query(
        `insert into terminal_event (
          terminal_id, kind, created_at, payload_json
        ) values (?, ?, ?, ?)`,
      )
      .run(input.terminalId, input.kind, createdAt, toJson(input.payload));
    return this.getEvent(Number(result.lastInsertRowid))!;
  }

  getReadCursor(terminalId: string, readerActorId: string): TerminalReadCursorRecord | undefined {
    const row = this.db
      .query(
        `select terminal_id, reader_actor_id, cursor_hash, updated_at
         from terminal_read_cursor
         where terminal_id = ? and reader_actor_id = ?`,
      )
      .get(terminalId, readerActorId) as Parameters<typeof mapReadCursor>[0] | null;
    return row ? mapReadCursor(row) : undefined;
  }

  upsertReadCursor(input: {
    terminalId: string;
    readerActorId: string;
    cursorHash: string | null;
    updatedAt?: number;
  }): TerminalReadCursorRecord {
    const updatedAt = input.updatedAt ?? Date.now();
    this.db
      .query(
        `insert into terminal_read_cursor (
          terminal_id, reader_actor_id, cursor_hash, updated_at
        ) values (?, ?, ?, ?)
        on conflict(terminal_id, reader_actor_id)
        do update set cursor_hash = excluded.cursor_hash, updated_at = excluded.updated_at`,
      )
      .run(input.terminalId, input.readerActorId, input.cursorHash, updatedAt);
    return this.getReadCursor(input.terminalId, input.readerActorId)!;
  }

  deleteReadCursors(terminalId: string): void {
    this.db.query(`delete from terminal_read_cursor where terminal_id = ?`).run(terminalId);
  }

  private purgeRemovedTerminal(terminalId: string): void {
    const result = this.db
      .query(`delete from terminal_catalog where terminal_id = ? and removed_at is not null`)
      .run(terminalId);
    if (Number(result.changes) > 0) {
      this.deleteTerminalDependents(terminalId);
    }
  }

  private deleteTerminalDependents(terminalId: string): void {
    this.db.query(`delete from terminal_grant where terminal_id = ?`).run(terminalId);
    this.db.query(`delete from terminal_invitation where terminal_id = ?`).run(terminalId);
    this.db.query(`delete from terminal_admin_candidate where terminal_id = ?`).run(terminalId);
    this.db.query(`delete from terminal_approval_request where terminal_id = ?`).run(terminalId);
    this.db.query(`delete from terminal_write_lease where terminal_id = ?`).run(terminalId);
    this.db.query(`delete from terminal_event where terminal_id = ?`).run(terminalId);
    this.deleteReadCursors(terminalId);
  }

  getEvent(eventId: number): TerminalEventRecord | undefined {
    const row = this.db
      .query(
        `select event_id, terminal_id, kind, created_at, payload_json
         from terminal_event
         where event_id = ?`,
      )
      .get(eventId) as Parameters<typeof mapEvent>[0] | null;
    return row ? mapEvent(row) : undefined;
  }

  listEventsPage(
    terminalId: string,
    input?: { before?: TerminalReverseCursor; limit?: number },
  ): TerminalReversePage<TerminalEventRecord> {
    const safeLimit = resolvePageLimit(input?.limit, 500);
    const rows =
      input?.before === undefined
        ? (this.db
            .query(
              `select event_id, terminal_id, kind, created_at, payload_json
               from terminal_event
               where terminal_id = ?
               order by created_at desc, event_id desc
               limit ?`,
            )
            .all(terminalId, safeLimit + 1) as Array<Parameters<typeof mapEvent>[0]>)
        : (this.db
            .query(
              `select event_id, terminal_id, kind, created_at, payload_json
               from terminal_event
               where terminal_id = ?
                 and (
                   created_at < ?
                   or (created_at = ? and event_id < ?)
                 )
               order by created_at desc, event_id desc
               limit ?`,
            )
            .all(
              terminalId,
              input.before.beforeTimeMs,
              input.before.beforeTimeMs,
              input.before.beforeId,
              safeLimit + 1,
            ) as Array<Parameters<typeof mapEvent>[0]>);

    const itemsDescending = rows.map(mapEvent).slice(0, safeLimit);
    const hasMoreBefore = rows.length > safeLimit;
    const items = [...itemsDescending].reverse();
    return {
      items,
      nextBefore: buildNextCursor(itemsDescending, hasMoreBefore, (item) => item.eventId),
      hasMoreBefore,
    };
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists terminal_catalog (
        terminal_id text primary key,
        process_kind text not null,
        backend text not null default 'xterm',
        command_json text not null,
        launch_cwd text not null,
        profile_json text,
        metadata_json text,
        process_phase text not null default 'not_started',
        last_stop_reason text,
        last_exit_code integer,
        last_exit_signal text,
        last_stopped_at integer,
        created_at integer not null,
        updated_at integer not null,
        removed_at integer
      );
      create table if not exists terminal_grant (
        grant_id text primary key,
        terminal_id text not null,
        role text not null,
        label text,
        participant_id text,
        access_token text,
        token_hash text,
        created_at integer not null,
        revoked_at integer
      );
      create table if not exists terminal_invitation (
        invitation_id text primary key,
        terminal_id text not null,
        inviter_participant_id text not null,
        invitee_participant_id text not null,
        native_payload_json text not null,
        payload_digest text not null,
        acceptance_token_hash text not null,
        descriptor_json text not null,
        status text not null,
        created_at integer not null,
        expires_at integer not null,
        accepted_at integer,
        revoked_at integer,
        superseded_by_invitation_id text
      );
      create table if not exists terminal_admin_candidate (
        terminal_id text not null,
        participant_id text not null,
        priority integer not null,
        primary key (terminal_id, participant_id)
      );
      create table if not exists terminal_approval_request (
        request_id text primary key,
        terminal_id text not null,
        participant_id text not null,
        assigned_admin_id text,
        created_at integer not null,
        expires_at integer not null,
        status text not null,
        requested_input_json text,
        decided_at integer,
        decided_by text,
        lease_id text
      );
      create table if not exists terminal_write_lease (
        lease_id text primary key,
        terminal_id text not null,
        participant_id text not null,
        granted_by text,
        request_id text,
        created_at integer not null,
        expires_at integer not null,
        revoked_at integer
      );
      create table if not exists terminal_event (
        event_id integer primary key autoincrement,
        terminal_id text not null,
        kind text not null,
        created_at integer not null,
        payload_json text
      );
      create table if not exists terminal_read_cursor (
        terminal_id text not null,
        reader_actor_id text not null,
        cursor_hash text,
        updated_at integer not null,
        primary key (terminal_id, reader_actor_id)
      );
      create index if not exists idx_terminal_catalog_updated on terminal_catalog(updated_at desc, terminal_id asc);
      create index if not exists idx_terminal_grant_terminal_participant on terminal_grant(terminal_id, participant_id, created_at desc, grant_id desc);
      create index if not exists idx_terminal_grant_token on terminal_grant(terminal_id, token_hash, created_at desc, grant_id desc);
      create index if not exists idx_terminal_invitation_terminal_invitee on terminal_invitation(terminal_id, invitee_participant_id, created_at desc, invitation_id desc);
      create index if not exists idx_terminal_invitation_token_hash on terminal_invitation(acceptance_token_hash, created_at desc, invitation_id desc);
      create index if not exists idx_terminal_invitation_terminal_status_expiry on terminal_invitation(terminal_id, status, expires_at asc, created_at desc);
      create index if not exists idx_terminal_request_terminal_status on terminal_approval_request(terminal_id, status, created_at asc, request_id asc);
      create index if not exists idx_terminal_lease_terminal_participant on terminal_write_lease(terminal_id, participant_id, expires_at desc, lease_id desc);
      create index if not exists idx_terminal_event_terminal_created on terminal_event(terminal_id, created_at desc, event_id desc);
      create index if not exists idx_terminal_read_cursor_terminal on terminal_read_cursor(terminal_id, updated_at desc);
    `);
    this.ensureCatalogColumns();
  }

  private ensureCatalogColumns(): void {
    const columns = new Set(
      (
        this.db
          .query(`pragma table_info(terminal_catalog)`)
          .all() as Array<{ name: string }>
      ).map((column) => column.name),
    );
    this.hasLegacyCwdColumn = columns.has("cwd");
    if (!columns.has("launch_cwd")) {
      this.db.query(`alter table terminal_catalog add column launch_cwd text`).run();
      this.db.query(`update terminal_catalog set launch_cwd = cwd where launch_cwd is null`).run();
    }
    if (!columns.has("backend")) {
      this.db.query(`alter table terminal_catalog add column backend text not null default 'xterm'`).run();
    }
    if (!columns.has("process_phase")) {
      this.db
        .query(`alter table terminal_catalog add column process_phase text not null default 'not_started'`)
        .run();
    }
    if (!columns.has("last_stop_reason")) {
      this.db.query(`alter table terminal_catalog add column last_stop_reason text`).run();
    }
    if (!columns.has("last_exit_code")) {
      this.db.query(`alter table terminal_catalog add column last_exit_code integer`).run();
    }
    if (!columns.has("last_exit_signal")) {
      this.db.query(`alter table terminal_catalog add column last_exit_signal text`).run();
    }
    if (!columns.has("last_stopped_at")) {
      this.db.query(`alter table terminal_catalog add column last_stopped_at integer`).run();
    }
    if (this.hasLegacyCwdColumn) {
      this.db.query(`update terminal_catalog set launch_cwd = coalesce(launch_cwd, cwd)`).run();
    }
    this.db.query(`update terminal_catalog set backend = coalesce(backend, 'xterm')`).run();
    this.db.query(`update terminal_grant set role = 'guard' where role = 'requester'`).run();
  }
}
