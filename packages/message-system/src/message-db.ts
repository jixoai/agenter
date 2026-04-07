import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";
import { isPrincipalId } from "@agenter/principal-crypto";

import type {
  MessageAppendInput,
  MessageActorId,
  MessageAttentionState,
  MessageChannelGrantRecord,
  MessageChannelPatchInput,
  MessageKind,
  MessagePayload,
  MessageChannelRecord,
  MessageCreateInput,
  MessageEditInput,
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
const MESSAGE_DB_SCHEMA_VERSION = 3;
const normalizeActorIds = (value: readonly MessageActorId[]): MessageActorId[] =>
  [...new Set(value)].sort((left, right) => left.localeCompare(right));
const parseActorIds = (value: string | null): MessageActorId[] =>
  normalizeActorIds(parseJson<string[]>(value, []).filter(isStoredActorId));

const normalizeMessageKind = (value: string | null): MessageKind => {
  if (value === "error" || value === "interactive") {
    return value;
  }
  return "text";
};

const normalizeAttentionState = (value: string | null): MessageAttentionState => {
  if (value === "queued") {
    return "queued";
  }
  return "loaded";
};

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
  attention_state: string | null;
  attention_loaded_at: number | null;
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
  attentionState: normalizeAttentionState(row.attention_state),
  attentionLoadedAt: row.attention_loaded_at ?? undefined,
  editable: normalizeAttentionState(row.attention_state) === "queued",
  readActorIds: parseActorIds(row.read_actor_ids_json),
  unreadActorIds: parseActorIds(row.unread_actor_ids_json),
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  attachments: parseJson(row.attachments_json, []),
  payload: parseMessagePayload(normalizeMessageKind(row.kind), row.payload_json),
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
    this.db.query(`delete from chat_channel where chat_id = ?`).run(chatId);
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

  appendMessage(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const kind = input.kind ?? "text";
    const attentionState = input.attentionState ?? "loaded";
    const visibleAt = input.visibleAt ?? createdAt;
    const attentionLoadedAt = input.attentionLoadedAt ?? (attentionState === "loaded" ? visibleAt : null);
    const from = input.from ?? (input.senderActorId ? input.senderActorId.split(":").at(-1) ?? "User" : "User");
    const result = this.db
      .query(
        `insert into chat_message (
          message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        attentionState,
        attentionLoadedAt,
        toJson(normalizeActorIds(input.readActorIds ?? [])),
        toJson(normalizeActorIds(input.unreadActorIds ?? [])),
        toJson(input.metadata ?? {}),
        toJson(input.attachments ?? []),
        toJson(input.payload ?? {}),
      );
    this.touchChannel(input.chatId, createdAt);
    const rowId = Number(result.lastInsertRowid);
    const row = this.getMessageRowByDbId(rowId);
    if (!row) {
      throw new Error("failed to load inserted message");
    }
    return mapMessage(row);
  }

  getMessage(chatId: string, messageId: string): MessageRecord | undefined {
    const row = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ? and message_id = ?`,
      )
      .get(chatId, messageId) as Parameters<typeof mapMessage>[0] | null;
    return row ? mapMessage(row) : undefined;
  }

  editQueuedMessage(input: MessageEditInput): MessageRecord {
    const current = this.getMessage(input.chatId, input.messageId);
    if (!current) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    if (current.attentionState !== "queued") {
      throw new Error("queued message can no longer be edited");
    }
    const updatedAt = Date.now();
    const kind = current.kind;
    this.db
      .query(
        `update chat_message
         set content = ?, updated_at = ?, metadata_json = ?, attachments_json = ?, payload_json = ?
         where chat_id = ? and message_id = ?`,
      )
      .run(
        input.content,
        updatedAt,
        toJson(input.metadata ?? current.metadata ?? {}),
        toJson(input.attachments ?? current.attachments ?? []),
        toJson(input.payload ?? current.payload ?? {}),
        input.chatId,
        input.messageId,
      );
    this.touchChannel(input.chatId, updatedAt);
    const row = this.getMessage(input.chatId, input.messageId);
    if (!row || row.kind !== kind) {
      throw new Error("failed to load edited message");
    }
    return row;
  }

  markMessageAttentionLoaded(input: { chatId: string; messageId: string; loadedAt?: number }): MessageRecord {
    const current = this.getMessage(input.chatId, input.messageId);
    if (!current) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    if (current.attentionState === "loaded") {
      return current;
    }
    const loadedAt = input.loadedAt ?? Date.now();
    const visibleAt = current.visibleAt ?? loadedAt;
    this.db
      .query(
        `update chat_message
         set updated_at = ?, visible_at = ?, attention_state = 'loaded', attention_loaded_at = ?
         where chat_id = ? and message_id = ?`,
      )
      .run(loadedAt, visibleAt, loadedAt, input.chatId, input.messageId);
    this.touchChannel(input.chatId, loadedAt);
    const next = this.getMessage(input.chatId, input.messageId);
    if (!next) {
      throw new Error("failed to load attention-loaded message");
    }
    return next;
  }

  pageMessages(chatId: string, input: { before?: ReverseTimeCursor | null; limit?: number }): ReversePage<MessageRecord> {
    const safeLimit = resolvePageLimit(input.limit);
    const before = input.before ?? undefined;
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
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
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
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
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message
         where chat_id = ?
           and visible_at is not null
           and id <= ?
         order by id asc`,
      )
      .all(input.chatId, input.targetRowId) as Array<Parameters<typeof mapMessage>[0]>;

    let changed = false;
    const updateReadState = this.db.query(
      `update chat_message
       set read_actor_ids_json = ?, unread_actor_ids_json = ?
       where id = ?`,
    );

    for (const row of rows) {
      const message = mapMessage(row);
      const hasReadActor = message.readActorIds.includes(input.actorId);
      const hasUnreadActor = message.unreadActorIds.includes(input.actorId);
      if (!hasReadActor && !hasUnreadActor) {
        continue;
      }
      const nextReadActorIds = normalizeActorIds([...message.readActorIds, input.actorId]);
      const nextUnreadActorIds = message.unreadActorIds.filter((actorId) => actorId !== input.actorId);
      if (
        nextReadActorIds.length === message.readActorIds.length &&
        nextUnreadActorIds.length === message.unreadActorIds.length
      ) {
        continue;
      }
      updateReadState.run(toJson(nextReadActorIds), toJson(nextUnreadActorIds), message.rowId);
      changed = true;
    }

    return { changed };
  }

  private touchChannel(chatId: string, updatedAt: number): void {
    this.db.query(`update chat_channel set updated_at = ? where chat_id = ?`).run(updatedAt, chatId);
  }

  private getMessageRowByDbId(id: number): Parameters<typeof mapMessage>[0] | null {
    return this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, sender_actor_id, from_id, to_id, kind, content, created_at, updated_at, visible_at, attention_state, attention_loaded_at, read_actor_ids_json, unread_actor_ids_json, metadata_json, attachments_json, payload_json
         from chat_message where id = ?`,
      )
      .get(id) as Parameters<typeof mapMessage>[0] | null;
  }

  private migrate(): void {
    const userVersionRow = this.db.query(`pragma user_version`).get() as { user_version?: number } | null;
    const currentSchemaVersion = userVersionRow?.user_version ?? 0;
    const hasLegacyMessageTables =
      this.hasTable("chat_channel") || this.hasTable("chat_channel_grant") || this.hasTable("chat_message");
    const hasLegacyReadStateTable = this.hasTable("chat_read_state");
    const needsBreakingReset =
      currentSchemaVersion < MESSAGE_DB_SCHEMA_VERSION && (hasLegacyMessageTables || hasLegacyReadStateTable);

    if (needsBreakingReset) {
      // The read model moved from mutable per-seat cursors to frozen per-message arrays.
      // Old room durability cannot be upgraded losslessly, so reset message-system truth.
      this.db.exec(`
        drop table if exists chat_message;
        drop table if exists chat_channel_grant;
        drop table if exists chat_channel;
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
        attention_state text not null default 'loaded',
        attention_loaded_at integer,
        read_actor_ids_json text not null default '[]',
        unread_actor_ids_json text not null default '[]',
        metadata_json text,
        attachments_json text,
        payload_json text,
        foreign key(chat_id) references chat_channel(chat_id) on delete cascade
      );

      create index if not exists idx_chat_channel_updated on chat_channel(updated_at desc, chat_id asc);
      create index if not exists idx_chat_channel_archived on chat_channel(archived_at, updated_at desc, chat_id asc);
      create index if not exists idx_chat_channel_grant_chat_created on chat_channel_grant(chat_id, created_at desc, grant_id desc);
      create index if not exists idx_chat_message_chat_created on chat_message(chat_id, created_at desc, id desc);
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
    const hasAttentionStateColumn = messageColumns.some((column) => column.name === "attention_state");
    if (!hasAttentionStateColumn) {
      this.db.exec(`alter table chat_message add column attention_state text not null default 'loaded';`);
    }
    const hasAttentionLoadedAtColumn = messageColumns.some((column) => column.name === "attention_loaded_at");
    if (!hasAttentionLoadedAtColumn) {
      this.db.exec(`alter table chat_message add column attention_loaded_at integer;`);
      this.db.exec(`update chat_message set attention_loaded_at = coalesce(attention_loaded_at, visible_at, created_at);`);
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
    this.db.exec(`update chat_message set updated_at = coalesce(updated_at, created_at);`);
    this.db.exec(`update chat_message set attention_state = coalesce(attention_state, 'loaded');`);
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
    this.db.exec(`pragma user_version = ${MESSAGE_DB_SCHEMA_VERSION};`);
  }

  private hasTable(name: string): boolean {
    const row = this.db
      .query(`select 1 from sqlite_master where type = 'table' and name = ? limit 1`)
      .get(name) as { 1?: number } | null;
    return row !== null;
  }
}
