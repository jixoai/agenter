import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import type {
  MessageAppendInput,
  MessageChannelGrantRecord,
  MessageChannelPatchInput,
  MessageKind,
  MessagePayload,
  MessageChannelRecord,
  MessageCreateInput,
  MessageIssueGrantInput,
  MessageParticipant,
  MessageRecord,
  ReversePage,
  ReverseTimeCursor,
} from "./types";

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

const normalizeMessageKind = (value: string | null): MessageKind => {
  if (value === "error" || value === "interactive") {
    return value;
  }
  return "text";
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
  kind: row.kind === "room" ? "room" : "direct",
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
  created_at: number;
  revoked_at: number | null;
}): MessageChannelGrantRecord => ({
  grantId: row.grant_id,
  chatId: row.chat_id,
  role: row.role === "readonly" ? "readonly" : row.role === "member" ? "member" : "admin",
  label: row.label ?? undefined,
  participantId: row.participant_id ?? undefined,
  createdAt: row.created_at,
  revokedAt: row.revoked_at ?? undefined,
});

const mapMessage = (row: {
  row_id: number;
  message_id: string;
  chat_id: string;
  root_id: string | null;
  from_id: string;
  to_id: string | null;
  kind: string | null;
  content: string;
  created_at: number;
  metadata_json: string | null;
  attachments_json: string | null;
  payload_json: string | null;
}): MessageRecord => ({
  kind: normalizeMessageKind(row.kind),
  rowId: row.row_id,
  messageId: row.message_id,
  chatId: row.chat_id,
  rootId: row.root_id ?? undefined,
  from: row.from_id,
  to: row.to_id ?? undefined,
  content: row.content,
  createdAt: row.created_at,
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

  issueGrant(input: MessageIssueGrantInput & { chatId: string; tokenHash: string }): MessageChannelGrantRecord {
    const now = Date.now();
    const grantId = `grant-${crypto.randomUUID()}`;
    this.db
      .query(
        `insert into chat_channel_grant (
          grant_id, chat_id, token_hash, role, label, participant_id, created_at, revoked_at
        ) values (?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        grantId,
        input.chatId,
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
        `select grant_id, chat_id, role, label, participant_id, created_at, revoked_at
         from chat_channel_grant where chat_id = ? and grant_id = ?`,
      )
      .get(chatId, grantId) as Parameters<typeof mapGrant>[0] | null;
    return row ? mapGrant(row) : undefined;
  }

  findActiveGrantByToken(chatId: string, tokenHash: string): MessageChannelGrantRecord | undefined {
    const row = this.db
      .query(
        `select grant_id, chat_id, role, label, participant_id, created_at, revoked_at
         from chat_channel_grant
         where chat_id = ? and token_hash = ? and revoked_at is null`,
      )
      .get(chatId, tokenHash) as Parameters<typeof mapGrant>[0] | null;
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
        `select grant_id, chat_id, role, label, participant_id, created_at, revoked_at
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
         `select grant_id, chat_id, role, label, participant_id, created_at, revoked_at
         from chat_channel_grant
         where chat_id = ? and revoked_at is null
         order by created_at desc, rowid desc`,
      )
      .all(chatId) as Array<Parameters<typeof mapGrant>[0]>;
    return rows.map(mapGrant);
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

  appendMessage(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const kind = input.kind ?? "text";
    const result = this.db
      .query(
        `insert into chat_message (
          message_id, chat_id, root_id, from_id, to_id, kind, content, created_at, metadata_json, attachments_json, payload_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.messageId ?? createId(),
        input.chatId,
        input.rootId ?? null,
        input.from,
        input.to ?? null,
        kind,
        input.content,
        createdAt,
        toJson(input.metadata ?? {}),
        toJson(input.attachments ?? []),
        toJson(input.payload ?? {}),
      );
    this.touchChannel(input.chatId, createdAt);
    const rowId = Number(result.lastInsertRowid);
    const row = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, from_id, to_id, kind, content, created_at, metadata_json, attachments_json, payload_json
         from chat_message where id = ?`,
      )
      .get(rowId) as Parameters<typeof mapMessage>[0] | null;
    if (!row) {
      throw new Error("failed to load inserted message");
    }
    return mapMessage(row);
  }

  pageMessages(chatId: string, input: { before?: ReverseTimeCursor | null; limit?: number }): ReversePage<MessageRecord> {
    const safeLimit = resolvePageLimit(input.limit);
    const before = input.before ?? undefined;
    const rows = this.db
      .query(
        `select id as row_id, message_id, chat_id, root_id, from_id, to_id, kind, content, created_at, metadata_json, attachments_json, payload_json
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

  private touchChannel(chatId: string, updatedAt: number): void {
    this.db.query(`update chat_channel set updated_at = ? where chat_id = ?`).run(updatedAt, chatId);
  }

  private migrate(): void {
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
        from_id text not null,
        to_id text,
        kind text not null default 'text',
        content text not null,
        created_at integer not null,
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
  }
}
