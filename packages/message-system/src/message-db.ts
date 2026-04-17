import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";
import { isPrincipalId } from "@agenter/principal-crypto";

import type {
  MessageAppendInput,
  MessageActorId,
  MessageActorRoomStateRecord,
  MessageActorStateRecord,
  MessageChannelGrantRecord,
  MessageChannelPatchInput,
  MessageKind,
  MessagePayload,
  MessageChannelRecord,
  MessageCreateInput,
  MessageEditInput,
  MessageRecallInput,
  MessageIssueGrantInput,
  MessageParticipant,
  MessageRecord,
  ReversePage,
  ReverseTimeCursor,
} from "./types";

const MESSAGE_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const isStoredActorId = (value: string): value is MessageActorId => MESSAGE_ACTOR_ID_PATTERN.test(value) || isPrincipalId(value);

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
const resolvePageLimit = (limit: number | undefined, max = 500): number => Math.max(1, Math.min(limit ?? 100, max));
const MESSAGE_DB_BREAKING_RESET_VERSION = 4;
const MESSAGE_DB_SCHEMA_VERSION = 5;
const normalizeActorIds = (value: readonly MessageActorId[]): MessageActorId[] =>
  [...new Set(value)].sort((left, right) => left.localeCompare(right));
const parseActorIds = (value: string | null): MessageActorId[] =>
  normalizeActorIds(parseJson<string[]>(value, []).filter(isStoredActorId));
const clampNonNegative = (value: number): number => Math.max(0, Math.trunc(value));
const remapActorId = (
  actorId: MessageActorId | undefined,
  actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
): MessageActorId | undefined => (actorId ? (actorIdMap.get(actorId) ?? actorId) : undefined);
const remapActorIds = (
  actorIds: readonly MessageActorId[],
  actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
): MessageActorId[] => normalizeActorIds(actorIds.map((actorId) => actorIdMap.get(actorId) ?? actorId));

const normalizeMessageKind = (value: string | null): MessageKind => {
  if (value === "error" || value === "interactive") {
    return value;
  }
  return "text";
};
const parseBoolean = (value: number | null | undefined): boolean => value === 1;

const parseMessagePayload = (kind: MessageKind, raw: string | null): MessagePayload | undefined => {
  const parsed = parseJson<Record<string, unknown>>(raw, {});
  if (kind === "error" && parsed.error && typeof parsed.error === "object") {
    return {
      error: parsed.error as MessagePayload["error"],
    };
  }
  if (kind === "interactive" && parsed.interactive && typeof parsed.interactive === "object") {
    return {
      interactive: parsed.interactive as MessagePayload["interactive"],
    };
  }
  return undefined;
};

const buildNextCursor = <T extends { createdAt: number; rowId: number }>(
  itemsDescending: T[],
  hasMoreBefore: boolean,
): ReverseTimeCursor | null => {
  if (!hasMoreBefore || itemsDescending.length === 0) {
    return null;
  }
  const oldest = itemsDescending.at(-1);
  return oldest
    ? {
        beforeTimeMs: oldest.createdAt,
        beforeId: oldest.rowId,
      }
    : null;
};

const createId = (): string => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const mapChannel = (
  row: {
    chat_id: string;
    kind: string;
    title: string;
    owner: string;
    context_id: string | null;
    participants_json: string;
    metadata_json: string | null;
    created_at: number;
    updated_at: number;
    archived_at: number | null;
    archived_by: string | null;
  },
  focused: boolean,
): MessageChannelRecord => ({
  chatId: row.chat_id,
  kind: "room",
  title: row.title,
  owner: row.owner,
  contextId: row.context_id ?? undefined,
  participants: parseJson<MessageParticipant[]>(row.participants_json, []),
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at ?? undefined,
  archivedBy: row.archived_by ?? undefined,
  focused,
});

const mapGrant = (row: {
  grant_id: string;
  chat_id: string;
  role: string;
  label: string | null;
  participant_id: string | null;
  access_token: string | null;
  created_at: number;
  revoked_at: number | null;
}): MessageChannelGrantRecord => ({
  grantId: row.grant_id,
  chatId: row.chat_id,
  role: row.role === "readonly" ? "readonly" : row.role === "member" ? "member" : "admin",
  label: row.label ?? undefined,
  participantId: (row.participant_id ?? undefined) as MessageActorId | undefined,
  accessToken: row.access_token ?? undefined,
  createdAt: row.created_at,
  revokedAt: row.revoked_at ?? undefined,
});

const mapMessage = (row: {
  row_id: number;
  message_id: string;
  chat_id: string;
  root_id: string | null;
  sender_actor_id: string | null;
  from_id: string;
  to_id: string | null;
  kind: string | null;
  content: string;
  created_at: number;
  updated_at: number;
  visible_at: number | null;
  recalled_at: number | null;
  recalled_by_actor_id: string | null;
  read_actor_ids_json: string | null;
  unread_actor_ids_json: string | null;
  metadata_json: string | null;
  attachments_json: string | null;
  payload_json: string | null;
}): MessageRecord => ({
  kind: normalizeMessageKind(row.kind),
  rowId: row.row_id,
  messageId: row.message_id,
  chatId: row.chat_id,
  rootId: row.root_id ?? undefined,
  senderActorId: (row.sender_actor_id ?? undefined) as MessageActorId | undefined,
  from: row.from_id,
  to: row.to_id ?? undefined,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  visibleAt: row.visible_at ?? undefined,
  recalledAt: row.recalled_at ?? undefined,
  recalledByActorId: (row.recalled_by_actor_id ?? undefined) as MessageActorId | undefined,
  readActorIds: parseActorIds(row.read_actor_ids_json),
  unreadActorIds: parseActorIds(row.unread_actor_ids_json),
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  attachments: parseJson(row.attachments_json, []),
  payload: parseMessagePayload(normalizeMessageKind(row.kind), row.payload_json),
});

const mapActorState = (row: {
  actor_id: string;
  unread_total: number;
  last_active_at: number | null;
  last_login_at: number | null;
  online: number;
  metadata_json: string | null;
}): MessageActorStateRecord => ({
  actorId: row.actor_id as MessageActorId,
  unreadTotal: clampNonNegative(row.unread_total),
  lastActiveAt: row.last_active_at ?? undefined,
  lastLoginAt: row.last_login_at ?? undefined,
  online: parseBoolean(row.online),
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
});

const mapActorRoomState = (row: {
  actor_id: string;
  chat_id: string;
  unread_count: number;
  last_read_row_id: number | null;
  last_read_at: number | null;
  latest_unread_row_id: number | null;
  latest_unread_at: number | null;
  metadata_json: string | null;
}): MessageActorRoomStateRecord => ({
  actorId: row.actor_id as MessageActorId,
  chatId: row.chat_id,
  unreadCount: clampNonNegative(row.unread_count),
  lastReadRowId: row.last_read_row_id ?? undefined,
  lastReadAt: row.last_read_at ?? undefined,
  latestUnreadRowId: row.latest_unread_row_id ?? undefined,
  latestUnreadAt: row.latest_unread_at ?? undefined,
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
});

export class MessageDb {
  private readonly db: Database;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.db.exec(`pragma foreign_keys = on;`);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  createChannel(input: MessageCreateInput, focused = false): MessageChannelRecord {
    const now = Date.now();
    this.db
      .query(
        `insert into chat_channel (
          chat_id, kind, title, owner, context_id, participants_json, metadata_json, created_at, updated_at, archived_at, archived_by
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null)`,
      )
      .run(
        input.chatId,
        input.kind,
        input.title ?? input.chatId,
        input.owner ?? "agenter",
        input.contextId ?? null,
        toJson(input.participants ?? []),
        toJson(input.metadata ?? {}),
        now,
        now,
      );
    return this.getChannel(input.chatId, focused)!;
  }

  getChannel(chatId: string, focused = false): MessageChannelRecord | undefined {
    const row = this.db
      .query(
        `select chat_id, kind, title, owner, context_id, participants_json, metadata_json, created_at, updated_at, archived_at, archived_by
         from chat_channel where chat_id = ?`,
      )
      .get(chatId) as Parameters<typeof mapChannel>[0] | null;
    return row ? mapChannel(row, focused) : undefined;
  }

  listChannels(focusedIds: Set<string>, includeArchived = false): MessageChannelRecord[] {
    const rows = this.db
      .query(
        `select chat_id, kind, title, owner, context_id, participants_json, metadata_json, created_at, updated_at, archived_at, archived_by
         from chat_channel
         where (? = 1 or archived_at is null)
         order by updated_at desc, chat_id asc`,
      )
      .all(includeArchived ? 1 : 0) as Array<Parameters<typeof mapChannel>[0]>;
    return rows.map((row) => mapChannel(row, focusedIds.has(row.chat_id)));
  }

  updateChannel(chatId: string, patch: MessageChannelPatchInput, focused = false): MessageChannelRecord {
    const current = this.getChannel(chatId, focused);
    if (!current) {
      throw new Error(`unknown chat channel: ${chatId}`);
    }
    const now = Date.now();
    this.db
      .query(
        `update chat_channel
         set title = ?, participants_json = ?, metadata_json = ?, updated_at = ?
         where chat_id = ?`,
      )
      .run(
        patch.title ?? current.title,
        toJson(patch.participants ?? current.participants),
        toJson(patch.metadata ?? current.metadata ?? {}),
        now,
        chatId,
      );
    return this.getChannel(chatId, focused)!;
  }

  repairMessageActorIds(
    chatId: string,
    actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
  ): { changed: boolean } {
    if (actorIdMap.size === 0) {
      return { changed: false };
    }
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
         order by id asc`,
      )
      .all(chatId) as Array<Parameters<typeof mapMessage>[0]>;

    let changed = false;
    const updateMessageActors = this.db.query(
      `update chat_message
       set sender_actor_id = ?, recalled_by_actor_id = ?, read_actor_ids_json = ?, unread_actor_ids_json = ?
       where id = ?`,
    );

    for (const row of rows) {
      const message = mapMessage(row);
      const nextSenderActorId = remapActorId(message.senderActorId, actorIdMap);
      const nextRecalledByActorId = remapActorId(message.recalledByActorId, actorIdMap);
      const nextReadActorIds = remapActorIds(message.readActorIds, actorIdMap);
      const nextUnreadActorIds = remapActorIds(message.unreadActorIds, actorIdMap).filter(
        (actorId) => !nextReadActorIds.includes(actorId),
      );
      if (
        nextSenderActorId === message.senderActorId &&
        nextRecalledByActorId === message.recalledByActorId &&
        nextReadActorIds.length === message.readActorIds.length &&
        nextUnreadActorIds.length === message.unreadActorIds.length &&
        nextReadActorIds.every((actorId, index) => actorId === message.readActorIds[index]) &&
        nextUnreadActorIds.every((actorId, index) => actorId === message.unreadActorIds[index])
      ) {
        continue;
      }
      updateMessageActors.run(
        nextSenderActorId ?? null,
        nextRecalledByActorId ?? null,
        toJson(nextReadActorIds),
        toJson(nextUnreadActorIds),
        message.rowId,
      );
      changed = true;
    }

    return { changed };
  }

  repairActorRoomStateAliases(
    chatId: string,
    actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
  ): { changed: boolean } {
    const aliases = [...actorIdMap.entries()].filter(
      (entry): entry is [MessageActorId, MessageActorId] => entry[0] !== entry[1],
    );
    if (aliases.length === 0) {
      return { changed: false };
    }
    const visibleMessages = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and visible_at is not null
         order by id asc`,
      )
      .all(chatId) as Array<Parameters<typeof mapMessage>[0]>;
    const messages = visibleMessages.map(mapMessage);

    const repair = this.db.transaction(() => {
      let changed = false;
      const touchedActors = new Set<MessageActorId>();
      const upsertActorRoomState = this.db.query(
        `insert into actor_room_state (
          actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(actor_id, chat_id) do update set
          unread_count = excluded.unread_count,
          last_read_row_id = excluded.last_read_row_id,
          last_read_at = excluded.last_read_at,
          latest_unread_row_id = excluded.latest_unread_row_id,
          latest_unread_at = excluded.latest_unread_at,
          metadata_json = excluded.metadata_json`,
      );

      for (const [fromActorId, toActorId] of aliases) {
        touchedActors.add(fromActorId);
        touchedActors.add(toActorId);
        const sourceState = this.getActorRoomState(chatId, fromActorId);
        const targetState = this.getActorRoomState(chatId, toActorId);
        const nextState = this.deriveRepairedActorRoomState(chatId, toActorId, messages, sourceState, targetState);
        if (sourceState) {
          this.db.query(`delete from actor_room_state where chat_id = ? and actor_id = ?`).run(chatId, fromActorId);
          changed = true;
        }
        if (!nextState) {
          continue;
        }
        const targetChanged =
          !targetState ||
          targetState.unreadCount !== nextState.unreadCount ||
          targetState.lastReadRowId !== nextState.lastReadRowId ||
          targetState.lastReadAt !== nextState.lastReadAt ||
          targetState.latestUnreadRowId !== nextState.latestUnreadRowId ||
          targetState.latestUnreadAt !== nextState.latestUnreadAt ||
          JSON.stringify(targetState.metadata ?? {}) !== JSON.stringify(nextState.metadata ?? {});
        if (!targetChanged) {
          continue;
        }
        this.ensureActorState(toActorId);
        upsertActorRoomState.run(
          toActorId,
          chatId,
          nextState.unreadCount,
          nextState.lastReadRowId ?? null,
          nextState.lastReadAt ?? null,
          nextState.latestUnreadRowId ?? null,
          nextState.latestUnreadAt ?? null,
          toJson(nextState.metadata ?? {}),
        );
        changed = true;
      }

      for (const actorId of touchedActors) {
        this.reconcileActorUnreadTotal(actorId);
      }

      return changed;
    });

    return { changed: repair() };
  }

  archiveChannel(chatId: string, archivedBy: string, focused = false): MessageChannelRecord {
    const current = this.getChannel(chatId, focused);
    if (!current) {
      throw new Error(`unknown chat channel: ${chatId}`);
    }
    if (current.archivedAt) {
      return current;
    }
    const now = Date.now();
    this.db
      .query(
        `update chat_channel
         set archived_at = ?, archived_by = ?, updated_at = ?
         where chat_id = ?`,
      )
      .run(now, archivedBy, now, chatId);
    return this.getChannel(chatId, focused)!;
  }

  deleteChannel(chatId: string, focused = false): MessageChannelRecord {
    const current = this.getChannel(chatId, focused);
    if (!current) {
      throw new Error(`unknown chat channel: ${chatId}`);
    }
    const removeChannel = this.db.transaction(() => {
      const roomStates = this.listActorRoomStatesByChat(chatId);
      for (const state of roomStates) {
        if (state.unreadCount > 0) {
          this.adjustActorUnreadTotal(state.actorId, -state.unreadCount);
        } else {
          this.ensureActorState(state.actorId);
        }
      }
      this.db.query(`delete from chat_channel where chat_id = ?`).run(chatId);
    });
    removeChannel();
    return current;
  }

  issueGrant(input: MessageIssueGrantInput & { chatId: string; accessToken: string; tokenHash: string }): MessageChannelGrantRecord {
    const now = Date.now();
    const grantId = `grant-${crypto.randomUUID()}`;
    this.db
      .query(
        `insert into chat_channel_grant (
          grant_id, chat_id, access_token, token_hash, role, label, participant_id, created_at, revoked_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        grantId,
        input.chatId,
        input.accessToken,
        input.tokenHash,
        input.role,
        input.label ?? null,
        input.participantId ?? null,
        now,
      );
    return this.getGrantById(input.chatId, grantId)!;
  }

  getGrantById(chatId: string, grantId: string): MessageChannelGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, chat_id, role, label, participant_id, access_token, created_at, revoked_at
         from chat_channel_grant where chat_id = ? and grant_id = ?`,
      )
      .get(chatId, grantId) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  updateGrant(
    chatId: string,
    grantId: string,
    patch: {
      role?: MessageIssueGrantInput["role"];
      label?: string;
      participantId?: string;
    },
  ): MessageChannelGrantRecord {
    const current = this.getGrantById(chatId, grantId);
    if (!current) {
      throw new Error(`unknown chat channel grant: ${grantId}`);
    }
    this.db
      .query(
        `update chat_channel_grant
         set role = ?, label = ?, participant_id = ?
         where chat_id = ? and grant_id = ?`,
      )
      .run(
        patch.role ?? current.role,
        patch.label ?? current.label ?? null,
        patch.participantId ?? current.participantId ?? null,
        chatId,
        grantId,
      );
    return this.getGrantById(chatId, grantId)!;
  }

  findActiveGrantByToken(chatId: string, accessToken: string, tokenHash: string): MessageChannelGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, chat_id, role, label, participant_id, access_token, created_at, revoked_at
         from chat_channel_grant
         where chat_id = ?
           and revoked_at is null
           and ((access_token is not null and access_token = ?) or token_hash = ?)`,
      )
      .get(chatId, accessToken, tokenHash) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  findReusableGrant(input: {
    chatId: string;
    role: MessageIssueGrantInput["role"];
    label?: string;
    participantId?: string;
  }): MessageChannelGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, chat_id, role, label, participant_id, access_token, created_at, revoked_at
         from chat_channel_grant
         where chat_id = ?
           and role = ?
           and coalesce(label, '') = coalesce(?, '')
           and coalesce(participant_id, '') = coalesce(?, '')
           and revoked_at is null
         order by created_at desc, rowid desc
         limit 1`,
      )
      .get(input.chatId, input.role, input.label ?? null, input.participantId ?? null) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  listActiveGrants(chatId: string): MessageChannelGrantRecord[] {
    const rows = this.db
      .query(
         `select grant_id, chat_id, role, label, participant_id, access_token, created_at, revoked_at
         from chat_channel_grant
         where chat_id = ? and revoked_at is null
         order by created_at desc, rowid desc`,
      )
      .all(chatId) as Array<Parameters<typeof mapGrant>[0]>;
    return rows.map(mapGrant);
  }

  listActorChannelAccess(actorId: string, includeArchived = false): Array<{
    channel: MessageChannelRecord;
    grant: MessageChannelGrantRecord;
  }> {
    const rows = this.db
      .query(
        `select
           channel.chat_id,
           channel.kind,
           channel.title,
           channel.owner,
           channel.context_id,
           channel.participants_json,
           channel.metadata_json,
           channel.created_at,
           channel.updated_at,
           channel.archived_at,
           channel.archived_by,
           grant.grant_id,
           grant.role,
           grant.label,
           grant.participant_id,
           grant.access_token,
           grant.created_at as grant_created_at,
           grant.revoked_at
         from chat_channel_grant as grant
         join chat_channel as channel on channel.chat_id = grant.chat_id
         where grant.participant_id = ?
           and grant.revoked_at is null
           and (? = 1 or channel.archived_at is null)
         order by channel.updated_at desc, channel.chat_id asc, grant.created_at desc, grant.rowid desc`,
      )
      .all(actorId, includeArchived ? 1 : 0) as Array<
      Parameters<typeof mapChannel>[0] & {
        grant_id: string;
        role: string;
        label: string | null;
        participant_id: string | null;
        access_token: string | null;
        grant_created_at: number;
        revoked_at: number | null;
      }
    >;
    const entries = new Map<string, { channel: MessageChannelRecord; grant: MessageChannelGrantRecord }>();
    for (const row of rows) {
      if (entries.has(row.chat_id)) {
        continue;
      }
      entries.set(row.chat_id, {
        channel: mapChannel(row, false),
        grant: mapGrant({
          grant_id: row.grant_id,
          chat_id: row.chat_id,
          role: row.role,
          label: row.label,
          participant_id: row.participant_id,
          access_token: row.access_token,
          created_at: row.grant_created_at,
          revoked_at: row.revoked_at,
        }),
      });
    }
    return [...entries.values()];
  }

  revokeGrant(chatId: string, grantId: string): boolean {
    const now = Date.now();
    const result = this.db
      .query(`update chat_channel_grant set revoked_at = ? where chat_id = ? and grant_id = ? and revoked_at is null`)
      .run(now, chatId, grantId);
    return Number(result.changes) > 0;
  }

  revokeActiveGrantsByDescriptor(input: {
    chatId: string;
    role: MessageIssueGrantInput["role"];
    label?: string;
    participantId?: string;
  }): void {
    const now = Date.now();
    this.db
      .query(
        `update chat_channel_grant
         set revoked_at = ?
         where chat_id = ?
           and role = ?
           and coalesce(label, '') = coalesce(?, '')
           and coalesce(participant_id, '') = coalesce(?, '')
           and revoked_at is null`,
      )
      .run(now, input.chatId, input.role, input.label ?? null, input.participantId ?? null);
  }

  revokeActiveGrantsByParticipant(chatId: string, participantId: string): void {
    const now = Date.now();
    this.db
      .query(
        `update chat_channel_grant
         set revoked_at = ?
         where chat_id = ?
           and participant_id = ?
           and revoked_at is null`,
      )
      .run(now, chatId, participantId);
  }

  getActorState(actorId: MessageActorId): MessageActorStateRecord | undefined {
    const row = this.db
      .query(
        `select actor_id, unread_total, last_active_at, last_login_at, online, metadata_json
         from actor_state
         where actor_id = ?`,
      )
      .get(actorId) as Parameters<typeof mapActorState>[0] | null;
    return row ? mapActorState(row) : undefined;
  }

  touchActorState(
    actorId: MessageActorId,
    patch: {
      lastActiveAt?: number;
      lastLoginAt?: number;
      online?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
  ): MessageActorStateRecord {
    return this.updateActorState(actorId, patch);
  }

  getActorRoomState(chatId: string, actorId: MessageActorId): MessageActorRoomStateRecord | undefined {
    const row = this.db
      .query(
        `select actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
         from actor_room_state
         where chat_id = ? and actor_id = ?`,
      )
      .get(chatId, actorId) as Parameters<typeof mapActorRoomState>[0] | null;
    return row ? mapActorRoomState(row) : undefined;
  }

  initializeActorRoomState(chatId: string, actorId: MessageActorId): MessageActorRoomStateRecord {
    const existing = this.getActorRoomState(chatId, actorId);
    if (existing) {
      return existing;
    }
    const latestVisibleMessage = this.resolveLatestVisibleMessage(chatId);
    this.ensureActorState(actorId);
    this.db
      .query(
        `insert into actor_room_state (
          actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
        ) values (?, ?, 0, ?, ?, null, null, ?)
        on conflict(actor_id, chat_id) do nothing`,
      )
      .run(
        actorId,
        chatId,
        latestVisibleMessage?.rowId ?? null,
        latestVisibleMessage?.visibleAt ?? latestVisibleMessage?.createdAt ?? null,
        toJson({}),
      );
    return this.getActorRoomState(chatId, actorId)!;
  }

  listUnreadRoomSummaries(actorId: MessageActorId, limit = 50): MessageActorRoomStateRecord[] {
    const safeLimit = resolvePageLimit(limit, 500);
    const rows = this.db
      .query(
        `select actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
         from actor_room_state
         where actor_id = ?
           and unread_count > 0
         order by latest_unread_at desc, latest_unread_row_id desc, chat_id asc
         limit ?`,
      )
      .all(actorId, safeLimit) as Array<Parameters<typeof mapActorRoomState>[0]>;
    return rows.map(mapActorRoomState);
  }

  clearActorRoomState(chatId: string, actorId: MessageActorId): { changed: boolean; removedUnreadCount: number } {
    const current = this.getActorRoomState(chatId, actorId);
    if (!current) {
      return { changed: false, removedUnreadCount: 0 };
    }
    const remove = this.db.transaction(() => {
      this.db.query(`delete from actor_room_state where chat_id = ? and actor_id = ?`).run(chatId, actorId);
      if (current.unreadCount > 0) {
        this.adjustActorUnreadTotal(actorId, -current.unreadCount);
      } else {
        this.ensureActorState(actorId);
      }
    });
    remove();
    return { changed: true, removedUnreadCount: current.unreadCount };
  }

  appendMessage(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const kind = input.kind ?? "text";
    const visibleAt = input.visibleAt ?? createdAt;
    const from = input.from ?? (input.senderActorId ? input.senderActorId.split(":").at(-1) ?? "User" : "User");
    const readActorIds = normalizeActorIds(input.readActorIds ?? []);
    const unreadActorIds = normalizeActorIds(input.unreadActorIds ?? []);
    const insertMessage = this.db.transaction(() => {
      const result = this.db
        .query(
          `insert into chat_message (
            message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.messageId ?? createId(),
          input.chatId,
          input.rootId ?? null,
          input.senderActorId ?? null,
          from,
          input.to ?? null,
          kind,
          input.content,
          createdAt,
          updatedAt,
          visibleAt,
          toJson(readActorIds),
          toJson(unreadActorIds),
          toJson(input.metadata ?? {}),
          toJson(input.attachments ?? []),
          toJson(input.payload ?? {}),
        );
      this.touchChannel(input.chatId, createdAt);
      const rowId = Number(result.lastInsertRowid);
      const visibleMessages = this.listVisibleMessages(input.chatId);
      const trackedActorIds = normalizeActorIds([...readActorIds, ...unreadActorIds]);
      for (const actorId of trackedActorIds) {
        this.reconcileActorRoomStateFromMessages(input.chatId, actorId, visibleMessages);
      }
      return rowId;
    });
    const rowId = insertMessage();
    const row = this.getMessageRowByDbId(rowId);
    if (!row) {
      throw new Error("failed to load inserted message");
    }
    return mapMessage(row);
  }

  editMessage(input: MessageEditInput): MessageRecord {
    const current = this.getMessage(input.chatId, input.messageId);
    if (!current) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    if (current.recalledAt) {
      throw new Error("cannot edit recalled message");
    }
    const updatedAt = input.updatedAt ?? Date.now();
    const updateMessage = this.db.transaction(() => {
      this.db
        .query(
          `update chat_message
           set content = ?, updated_at = ?
           where chat_id = ? and message_id = ?`,
        )
        .run(input.content, updatedAt, input.chatId, input.messageId);
      this.touchChannel(input.chatId, updatedAt);
    });
    updateMessage();
    const refreshed = this.getMessage(input.chatId, input.messageId);
    if (!refreshed) {
      throw new Error("failed to load updated message");
    }
    return refreshed;
  }

  recallMessage(input: MessageRecallInput): MessageRecord {
    const current = this.getMessage(input.chatId, input.messageId);
    if (!current) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    if (current.recalledAt) {
      return current;
    }
    const recalledAt = input.recalledAt ?? Date.now();
    const updatedAt = input.updatedAt ?? recalledAt;
    const recallMessage = this.db.transaction(() => {
      this.db
        .query(
          `update chat_message
           set content = '',
               updated_at = ?,
               recalled_at = ?,
               recalled_by_actor_id = ?,
               attachments_json = '[]',
               payload_json = null
           where chat_id = ? and message_id = ?`,
        )
        .run(updatedAt, recalledAt, input.recalledByActorId ?? null, input.chatId, input.messageId);
      this.touchChannel(input.chatId, updatedAt);
    });
    recallMessage();
    const refreshed = this.getMessage(input.chatId, input.messageId);
    if (!refreshed) {
      throw new Error("failed to load recalled message");
    }
    return refreshed;
  }

  getMessage(chatId: string, messageId: string): MessageRecord | undefined {
    const row = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ? and message_id = ?`,
      )
      .get(chatId, messageId) as Parameters<typeof mapMessage>[0] | null;
    return row ? mapMessage(row) : undefined;
  }

  pageMessages(chatId: string, input: { before?: ReverseTimeCursor | null; limit?: number }): ReversePage<MessageRecord> {
    const safeLimit = resolvePageLimit(input.limit);
    const before = input.before ?? undefined;
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and (
             ? is null
             or created_at < ?
             or (created_at = ? and id < ?)
           )
         order by created_at desc, id desc
         limit ?`,
      )
      .all(
        chatId,
        before?.beforeTimeMs ?? null,
        before?.beforeTimeMs ?? null,
        before?.beforeTimeMs ?? null,
        before?.beforeId ?? null,
        safeLimit + 1,
      ) as Array<Parameters<typeof mapMessage>[0]>;

    const hasMoreBefore = rows.length > safeLimit;
    const itemsDescending = rows.slice(0, safeLimit).map(mapMessage);
    return {
      items: [...itemsDescending].reverse(),
      nextBefore: buildNextCursor(itemsDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  snapshot(chatId: string, focused: boolean, limit = 50): { channel: MessageChannelRecord; items: MessageRecord[] } {
    const channel = this.getChannel(chatId, focused);
    if (!channel) {
      throw new Error(`unknown chat channel: ${chatId}`);
    }
    const page = this.pageMessages(chatId, { limit });
    return { channel, items: page.items };
  }

  resolveLatestVisibleMessage(chatId: string): MessageRecord | undefined {
    const row = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and visible_at is not null
         order by created_at desc, id desc
         limit 1`,
      )
      .get(chatId) as Parameters<typeof mapMessage>[0] | null;
    return row ? mapMessage(row) : undefined;
  }

  markMessagesReadUpTo(input: {
    chatId: string;
    actorId: MessageActorId;
    targetRowId: number;
  }): { changed: boolean } {
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and visible_at is not null
           and id <= ?
         order by id asc`,
      )
      .all(input.chatId, input.targetRowId) as Array<Parameters<typeof mapMessage>[0]>;
    if (rows.length === 0) {
      return { changed: false };
    }

    const markRead = this.db.transaction(() => {
      let changed = false;
      let removedUnreadCount = 0;
      const updateReadState = this.db.query(
        `update chat_message
         set read_actor_ids_json = ?, unread_actor_ids_json = ?
         where id = ?`,
      );

      for (const row of rows) {
        const message = mapMessage(row);
        const hasReadActor = message.readActorIds.includes(input.actorId);
        const hasUnreadActor = message.unreadActorIds.includes(input.actorId);
        const nextReadActorIds = hasReadActor
          ? message.readActorIds
          : normalizeActorIds([...message.readActorIds, input.actorId]);
        const nextUnreadActorIds = hasUnreadActor
          ? message.unreadActorIds.filter((actorId) => actorId !== input.actorId)
          : message.unreadActorIds;
        if (
          nextReadActorIds.length === message.readActorIds.length &&
          nextUnreadActorIds.length === message.unreadActorIds.length
        ) {
          continue;
        }
        updateReadState.run(toJson(nextReadActorIds), toJson(nextUnreadActorIds), message.rowId);
        if (hasUnreadActor) {
          removedUnreadCount += 1;
        }
        changed = true;
      }

      const visibleMessages = this.listVisibleMessages(input.chatId);
      this.reconcileActorRoomStateFromMessages(input.chatId, input.actorId, visibleMessages);
      return changed || removedUnreadCount > 0;
    });

    return { changed: markRead() };
  }

  private listActorRoomStatesByChat(chatId: string): MessageActorRoomStateRecord[] {
    const rows = this.db
      .query(
        `select actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
         from actor_room_state
         where chat_id = ?`,
      )
      .all(chatId) as Array<Parameters<typeof mapActorRoomState>[0]>;
    return rows.map(mapActorRoomState);
  }

  private ensureActorState(actorId: MessageActorId): void {
    this.db
      .query(
        `insert into actor_state (
          actor_id, unread_total, last_active_at, last_login_at, online, metadata_json
        ) values (?, 0, null, null, 0, ?)
        on conflict(actor_id) do nothing`,
      )
      .run(actorId, toJson({}));
  }

  private updateActorState(
    actorId: MessageActorId,
    patch: {
      unreadTotalDelta?: number;
      lastActiveAt?: number;
      lastLoginAt?: number;
      online?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): MessageActorStateRecord {
    this.ensureActorState(actorId);
    const current = this.getActorState(actorId)!;
    const next: MessageActorStateRecord = {
      actorId,
      unreadTotal: clampNonNegative(current.unreadTotal + (patch.unreadTotalDelta ?? 0)),
      lastActiveAt:
        patch.lastActiveAt !== undefined
          ? Math.max(current.lastActiveAt ?? 0, patch.lastActiveAt)
          : current.lastActiveAt,
      lastLoginAt:
        patch.lastLoginAt !== undefined
          ? Math.max(current.lastLoginAt ?? 0, patch.lastLoginAt)
          : current.lastLoginAt,
      online: patch.online ?? current.online,
      metadata: patch.metadata ?? current.metadata ?? {},
    };
    this.db
      .query(
        `update actor_state
         set unread_total = ?, last_active_at = ?, last_login_at = ?, online = ?, metadata_json = ?
         where actor_id = ?`,
      )
      .run(
        next.unreadTotal,
        next.lastActiveAt ?? null,
        next.lastLoginAt ?? null,
        next.online ? 1 : 0,
        toJson(next.metadata ?? {}),
        actorId,
      );
    return next;
  }

  private deriveRepairedActorRoomState(
    chatId: string,
    actorId: MessageActorId,
    messages: readonly MessageRecord[],
    sourceState?: MessageActorRoomStateRecord,
    targetState?: MessageActorRoomStateRecord,
  ): MessageActorRoomStateRecord | null {
    const trackedMessages = messages.filter(
      (message) => message.readActorIds.includes(actorId) || message.unreadActorIds.includes(actorId),
    );
    const unreadMessages = messages.filter((message) => message.unreadActorIds.includes(actorId));
    const earliestUnreadMessage = unreadMessages.at(0);
    const lastReadMessage =
      earliestUnreadMessage === undefined
        ? messages.at(-1)
        : messages.filter((message) => message.rowId < earliestUnreadMessage.rowId).at(-1);
    const latestUnreadMessage = unreadMessages.at(-1);
    const fallbackLastReadRowId = Math.max(sourceState?.lastReadRowId ?? 0, targetState?.lastReadRowId ?? 0);
    const fallbackLastReadAt = Math.max(sourceState?.lastReadAt ?? 0, targetState?.lastReadAt ?? 0);
    const hasDerivedState =
      trackedMessages.length > 0 ||
      unreadMessages.length > 0 ||
      sourceState !== undefined ||
      targetState !== undefined;
    if (!hasDerivedState) {
      return null;
    }
    return {
      actorId,
      chatId,
      unreadCount: unreadMessages.length,
      lastReadRowId:
        lastReadMessage?.rowId ?? (messages.length === 0 && fallbackLastReadRowId > 0 ? fallbackLastReadRowId : undefined),
      lastReadAt:
        (lastReadMessage?.visibleAt ?? lastReadMessage?.createdAt) ??
        (messages.length === 0 && fallbackLastReadAt > 0 ? fallbackLastReadAt : undefined),
      latestUnreadRowId: latestUnreadMessage?.rowId,
      latestUnreadAt: latestUnreadMessage?.visibleAt ?? latestUnreadMessage?.createdAt,
      metadata: {
        ...(sourceState?.metadata ?? {}),
        ...(targetState?.metadata ?? {}),
      },
    };
  }

  private listVisibleMessages(chatId: string): MessageRecord[] {
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and visible_at is not null
         order by id asc`,
      )
      .all(chatId) as Array<Parameters<typeof mapMessage>[0]>;
    return rows.map(mapMessage);
  }

  private hasSameActorRoomState(
    current: MessageActorRoomStateRecord | undefined,
    next: MessageActorRoomStateRecord,
  ): boolean {
    if (!current) {
      return false;
    }
    return (
      current.unreadCount === next.unreadCount &&
      current.lastReadRowId === next.lastReadRowId &&
      current.lastReadAt === next.lastReadAt &&
      current.latestUnreadRowId === next.latestUnreadRowId &&
      current.latestUnreadAt === next.latestUnreadAt &&
      JSON.stringify(current.metadata ?? {}) === JSON.stringify(next.metadata ?? {})
    );
  }

  private upsertActorRoomState(state: MessageActorRoomStateRecord): void {
    this.ensureActorState(state.actorId);
    this.db
      .query(
        `insert into actor_room_state (
          actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(actor_id, chat_id) do update set
          unread_count = excluded.unread_count,
          last_read_row_id = excluded.last_read_row_id,
          last_read_at = excluded.last_read_at,
          latest_unread_row_id = excluded.latest_unread_row_id,
          latest_unread_at = excluded.latest_unread_at,
          metadata_json = excluded.metadata_json`,
      )
      .run(
        state.actorId,
        state.chatId,
        state.unreadCount,
        state.lastReadRowId ?? null,
        state.lastReadAt ?? null,
        state.latestUnreadRowId ?? null,
        state.latestUnreadAt ?? null,
        toJson(state.metadata ?? {}),
      );
  }

  private reconcileActorRoomStateFromMessages(
    chatId: string,
    actorId: MessageActorId,
    messages = this.listVisibleMessages(chatId),
  ): void {
    const current = this.getActorRoomState(chatId, actorId);
    const next = this.deriveRepairedActorRoomState(chatId, actorId, messages, current);
    if (!next) {
      if (current) {
        this.db.query(`delete from actor_room_state where chat_id = ? and actor_id = ?`).run(chatId, actorId);
        if (current.unreadCount > 0) {
          this.adjustActorUnreadTotal(actorId, -current.unreadCount);
        } else {
          this.ensureActorState(actorId);
        }
      } else {
        this.ensureActorState(actorId);
      }
      return;
    }
    const unreadDelta = next.unreadCount - (current?.unreadCount ?? 0);
    if (!this.hasSameActorRoomState(current, next)) {
      this.upsertActorRoomState(next);
    } else {
      this.ensureActorState(actorId);
    }
    if (unreadDelta !== 0) {
      this.adjustActorUnreadTotal(actorId, unreadDelta);
    }
  }

  private repairMaterializedActorUnreadState(): void {
    const roomStateRows = this.db
      .query(
        `select actor_id, chat_id, unread_count, last_read_row_id, last_read_at, latest_unread_row_id, latest_unread_at, metadata_json
         from actor_room_state
         order by chat_id asc, actor_id asc`,
      )
      .all() as Array<Parameters<typeof mapActorRoomState>[0]>;
    const actorIds = (
      this.db.query(`select actor_id from actor_state order by actor_id asc`).all() as Array<{ actor_id: string }>
    ).map((row) => row.actor_id as MessageActorId);
    if (roomStateRows.length === 0 && actorIds.length === 0) {
      return;
    }
    const repair = this.db.transaction(() => {
      const messagesByChat = new Map<string, MessageRecord[]>();
      for (const row of roomStateRows) {
        const current = mapActorRoomState(row);
        const messages = messagesByChat.get(current.chatId) ?? this.listVisibleMessages(current.chatId);
        messagesByChat.set(current.chatId, messages);
        this.reconcileActorRoomStateFromMessages(current.chatId, current.actorId, messages);
      }
      for (const actorId of new Set([...actorIds, ...roomStateRows.map((row) => row.actor_id as MessageActorId)])) {
        this.reconcileActorUnreadTotal(actorId);
      }
    });
    repair();
  }

  private reconcileActorUnreadTotal(actorId: MessageActorId): void {
    this.ensureActorState(actorId);
    const current = this.getActorState(actorId)!;
    const row = this.db
      .query(
        `select coalesce(sum(unread_count), 0) as unread_total
         from actor_room_state
         where actor_id = ?`,
      )
      .get(actorId) as { unread_total?: number | null } | null;
    const unreadTotal = Number(row?.unread_total ?? 0);
    if (current.unreadTotal === unreadTotal) {
      return;
    }
    this.updateActorState(actorId, {
      unreadTotalDelta: unreadTotal - current.unreadTotal,
    });
  }

  private adjustActorUnreadTotal(actorId: MessageActorId, delta: number): void {
    this.updateActorState(actorId, { unreadTotalDelta: delta });
  }

  private touchChannel(chatId: string, updatedAt: number): void {
    this.db.query(`update chat_channel set updated_at = ? where chat_id = ?`).run(updatedAt, chatId);
  }

  private getMessageRowByDbId(id: number): Parameters<typeof mapMessage>[0] | null {
    return this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, recalled_at, recalled_by_actor_id, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message where id = ?`,
      )
      .get(id) as Parameters<typeof mapMessage>[0] | null;
  }

  private migrate(): void {
    const userVersionRow = this.db.query(`pragma user_version`).get() as { user_version?: number } | null;
    const currentSchemaVersion = userVersionRow?.user_version ?? 0;
    const hasLegacyMessageTables =
      this.hasTable("chat_channel") ||
      this.hasTable("chat_channel_grant") ||
      this.hasTable("chat_message") ||
      this.hasTable("actor_state") ||
      this.hasTable("actor_room_state");
    const hasLegacyReadStateTable = this.hasTable("chat_read_state");
    const needsBreakingReset =
      currentSchemaVersion < MESSAGE_DB_BREAKING_RESET_VERSION && (hasLegacyMessageTables || hasLegacyReadStateTable);

    if (needsBreakingReset) {
      // The read model moved from mutable per-seat cursors to frozen per-message arrays.
      // Old room durability cannot be upgraded losslessly, so reset message-system truth.
      this.db.exec(`
        drop table if exists chat_message;
        drop table if exists chat_channel_grant;
        drop table if exists chat_channel;
        drop table if exists actor_room_state;
        drop table if exists actor_state;
        drop table if exists chat_read_state;
      `);
    }

    this.db.exec(`
      create table if not exists chat_channel (
        chat_id text primary key,
        kind text not null,
        title text not null,
        owner text not null,
        context_id text,
        participants_json text not null,
        metadata_json text,
        created_at integer not null,
        updated_at integer not null,
        archived_at integer,
        archived_by text
      );

      create table if not exists chat_channel_grant (
        grant_id text primary key,
        chat_id text not null,
        access_token text unique,
        token_hash text not null unique,
        role text not null,
        label text,
        participant_id text,
        created_at integer not null,
        revoked_at integer,
        foreign key(chat_id) references chat_channel(chat_id) on delete cascade
      );

      create table if not exists chat_message (
        id integer primary key autoincrement,
        message_id text not null unique,
        chat_id text not null,
        root_id text,
        sender_actor_id text,
        from_id text not null,
        to_id text,
        kind text not null default 'text',
        content text not null,
        created_at integer not null,
        updated_at integer not null,
        visible_at integer,
        recalled_at integer,
        recalled_by_actor_id text,
        read_actor_ids_json text not null default '[]',
        unread_actor_ids_json text not null default '[]',
        metadata_json text,
        attachments_json text,
        payload_json text,
        foreign key(chat_id) references chat_channel(chat_id) on delete cascade
      );

      create table if not exists actor_state (
        actor_id text primary key,
        unread_total integer not null default 0,
        last_active_at integer,
        last_login_at integer,
        online integer not null default 0,
        metadata_json text
      );

      create table if not exists actor_room_state (
        actor_id text not null,
        chat_id text not null,
        unread_count integer not null default 0,
        last_read_row_id integer,
        last_read_at integer,
        latest_unread_row_id integer,
        latest_unread_at integer,
        metadata_json text,
        primary key(actor_id, chat_id),
        foreign key(chat_id) references chat_channel(chat_id) on delete cascade,
        foreign key(actor_id) references actor_state(actor_id) on delete cascade
      );

      create index if not exists idx_chat_channel_updated on chat_channel(updated_at desc, chat_id asc);
      create index if not exists idx_chat_channel_archived on chat_channel(archived_at, updated_at desc, chat_id asc);
      create index if not exists idx_chat_channel_grant_chat_created on chat_channel_grant(chat_id, created_at desc, grant_id desc);
      create index if not exists idx_chat_message_chat_created on chat_message(chat_id, created_at desc, id desc);
      create index if not exists idx_actor_state_unread_total on actor_state(unread_total desc, actor_id asc);
      create index if not exists idx_actor_room_state_unread on actor_room_state(actor_id, unread_count desc, latest_unread_at desc, chat_id asc);
    `);

    const messageColumns = this.db
      .query(`pragma table_info(chat_message)`)
      .all() as Array<{ name: string }>;
    const hasKindColumn = messageColumns.some((column) => column.name === "kind");
    if (!hasKindColumn) {
      this.db.exec(`alter table chat_message add column kind text not null default 'text';`);
    }
    const hasPayloadColumn = messageColumns.some((column) => column.name === "payload_json");
    if (!hasPayloadColumn) {
      this.db.exec(`alter table chat_message add column payload_json text;`);
    }
    const hasUpdatedAtColumn = messageColumns.some((column) => column.name === "updated_at");
    if (!hasUpdatedAtColumn) {
      this.db.exec(`alter table chat_message add column updated_at integer;`);
      this.db.exec(`update chat_message set updated_at = created_at where updated_at is null;`);
    }
    const hasVisibleAtColumn = messageColumns.some((column) => column.name === "visible_at");
    if (!hasVisibleAtColumn) {
      this.db.exec(`alter table chat_message add column visible_at integer;`);
      this.db.exec(`update chat_message set visible_at = created_at where visible_at is null;`);
    }
    const hasSenderActorIdColumn = messageColumns.some((column) => column.name === "sender_actor_id");
    if (!hasSenderActorIdColumn) {
      this.db.exec(`alter table chat_message add column sender_actor_id text;`);
    }
    const hasReadActorIdsColumn = messageColumns.some((column) => column.name === "read_actor_ids_json");
    if (!hasReadActorIdsColumn) {
      this.db.exec(`alter table chat_message add column read_actor_ids_json text not null default '[]';`);
    }
    const hasUnreadActorIdsColumn = messageColumns.some((column) => column.name === "unread_actor_ids_json");
    if (!hasUnreadActorIdsColumn) {
      this.db.exec(`alter table chat_message add column unread_actor_ids_json text not null default '[]';`);
    }
    const hasRecalledAtColumn = messageColumns.some((column) => column.name === "recalled_at");
    if (!hasRecalledAtColumn) {
      this.db.exec(`alter table chat_message add column recalled_at integer;`);
    }
    const hasRecalledByActorIdColumn = messageColumns.some((column) => column.name === "recalled_by_actor_id");
    if (!hasRecalledByActorIdColumn) {
      this.db.exec(`alter table chat_message add column recalled_by_actor_id text;`);
    }
    this.db.exec(`update chat_message set updated_at = coalesce(updated_at, created_at);`);
    this.db.exec(`update chat_message set read_actor_ids_json = coalesce(read_actor_ids_json, '[]');`);
    this.db.exec(`update chat_message set unread_actor_ids_json = coalesce(unread_actor_ids_json, '[]');`);

    const channelColumns = this.db
      .query(`pragma table_info(chat_channel)`)
      .all() as Array<{ name: string }>;
    const hasArchivedAt = channelColumns.some((column) => column.name === "archived_at");
    if (!hasArchivedAt) {
      this.db.exec(`alter table chat_channel add column archived_at integer;`);
    }
    const hasArchivedBy = channelColumns.some((column) => column.name === "archived_by");
    if (!hasArchivedBy) {
      this.db.exec(`alter table chat_channel add column archived_by text;`);
    }

    const grantColumns = this.db
      .query(`pragma table_info(chat_channel_grant)`)
      .all() as Array<{ name: string }>;
    const hasAccessTokenColumn = grantColumns.some((column) => column.name === "access_token");
    if (!hasAccessTokenColumn) {
      this.db.exec(`alter table chat_channel_grant add column access_token text;`);
    }

    this.db.exec(`drop table if exists chat_read_state;`);
    this.repairMaterializedActorUnreadState();
    this.db.exec(`pragma user_version = ${MESSAGE_DB_SCHEMA_VERSION};`);
  }

  private hasTable(name: string): boolean {
    const row = this.db
      .query(`select 1 from sqlite_master where type = 'table' and name = ? limit 1`)
      .get(name) as { 1?: number } | null;
    return row !== null;
  }
}
