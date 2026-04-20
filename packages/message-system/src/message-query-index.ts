import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";
import {
  compileMessageQuery,
  type MessageQueryCandidateFilter,
  type MessageQueryDocument,
} from "./message-query-compile";
import { assertReadOnlyMessageQuerySql } from "./message-query-sql";
import type { MessageQueryMode, MessageQueryScalar, MessageQuerySqlResult } from "./message-query-types";
import type { MessageChannelRecord, MessageRecord } from "./types";

const resolveOffset = (offset: number | undefined): number => Math.max(0, Math.trunc(offset ?? 0));
const resolveLimit = (limit: number | undefined, max = 100): number => Math.max(1, Math.min(limit ?? 20, max));
const toSqliteBoolean = (value: boolean): number => (value ? 1 : 0);
const MESSAGE_QUERY_DB_BREAKING_RESET_VERSION = 2;
const MESSAGE_QUERY_DB_SCHEMA_VERSION = 2;

type IndexedMessageRow = {
  doc_id: number;
  chat_id: string;
  chat_title: string;
  context_id: string | null;
  room_archived_at: number | null;
  message_id: number;
  ref_id: number | null;
  sender_actor_id: string | null;
  from_id: string;
  kind: string;
  content: string;
  normalized_content: string;
  search_text: string;
  created_at: number;
  updated_at: number;
  visible_at: number | null;
  recalled_at: number | null;
  has_attachment: number;
  attachment_count: number;
};

type IndexedRoomRow = {
  chat_id: string;
  title: string;
  context_id: string | null;
  archived_at: number | null;
  updated_at: number;
};

export interface MessageQueryDocHit {
  chatId: string;
  chatTitle?: string;
  contextId?: string;
  messageId: number;
  score?: number;
}

export interface MessageQueryDocPage {
  mode: Exclude<MessageQueryMode, "sql">;
  chatIds: string[];
  offset: number;
  limit: number;
  nextOffset: number | null;
  hasMore: boolean;
  items: MessageQueryDocHit[];
}

const mapDocument = (row: IndexedMessageRow): MessageQueryDocument => ({
  chatId: row.chat_id,
  chatTitle: row.chat_title,
  contextId: row.context_id,
  messageId: row.message_id,
  ref: row.ref_id,
  senderActorId: row.sender_actor_id,
  from: row.from_id,
  kind: row.kind,
  content: row.content,
  normalizedContent: row.normalized_content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  visibleAt: row.visible_at,
  recalledAt: row.recalled_at,
  hasAttachment: row.has_attachment === 1,
  attachmentCount: row.attachment_count,
  searchText: row.search_text.toLowerCase(),
});

const buildSearchText = (channel: MessageChannelRecord, message: MessageRecord): string =>
  [
    message.content,
    message.from,
    message.senderActorId ?? "",
    message.chatId,
    channel.title,
    channel.contextId ?? "",
    message.ref !== undefined ? String(message.ref) : "",
    message.kind,
  ]
    .join("\n")
    .trim();

const buildChatScopeSql = (chatIds: readonly string[]): { sql: string; params: string[] } => ({
  sql: `doc.chat_id in (${chatIds.map(() => "?").join(", ")})`,
  params: [...chatIds],
});

const buildCandidateFilterSql = (
  filter: MessageQueryCandidateFilter,
): { sql: string; params: Array<string | number> } => {
  if (filter.kind === "from") {
    return {
      sql: `(lower(coalesce(doc.sender_actor_id, '')) = ? or instr(lower(doc.from_id), ?) > 0)`,
      params: [filter.value, filter.value],
    };
  }
  if (filter.kind === "chat") {
    return {
      sql: `(lower(doc.chat_id) = ? or instr(lower(doc.chat_title), ?) > 0)`,
      params: [filter.value, filter.value],
    };
  }
  if (filter.kind === "context") {
    return {
      sql: `(lower(coalesce(doc.context_id, '')) = ? or instr(lower(coalesce(doc.context_id, '')), ?) > 0)`,
      params: [filter.value, filter.value],
    };
  }
  if (filter.kind === "kind") {
    return {
      sql: `lower(doc.kind) = ?`,
      params: [filter.value],
    };
  }
  if (filter.kind === "ref") {
    return {
      sql: `doc.ref_id = ?`,
      params: [filter.value],
    };
  }
  if (filter.kind === "has") {
    return filter.value === "attachment"
      ? { sql: `doc.attachment_count > 0`, params: [] }
      : { sql: `doc.recalled_at is not null`, params: [] };
  }
  if (filter.kind === "is") {
    if (filter.value === "recalled") {
      return { sql: `doc.recalled_at is not null`, params: [] };
    }
    if (filter.value === "visible") {
      return { sql: `doc.visible_at is not null`, params: [] };
    }
    return { sql: `doc.visible_at is null`, params: [] };
  }
  const column =
    filter.field === "createdAt"
      ? "doc.created_at"
      : filter.field === "updatedAt"
        ? "doc.updated_at"
        : "doc.message_id";
  const operator = filter.operator === ":" ? "=" : filter.operator;
  return {
    sql: `${column} ${operator} ?`,
    params: [filter.value],
  };
};

const normalizeMessageQueryRow = (row: Record<string, unknown>): Record<string, MessageQueryScalar> => {
  const normalized: Record<string, MessageQueryScalar> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] =
      typeof value === "string" || typeof value === "number" || value === null ? value : String(value ?? "");
  }
  return normalized;
};

export class MessageQueryIndex {
  private readonly db: Database;
  private readonly ftsEnabled: boolean;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.db.exec(`pragma journal_mode = WAL;`);
    this.db.exec(`pragma foreign_keys = on;`);
    this.ftsEnabled = this.initializeSchema();
  }

  close(): void {
    this.db.close();
  }

  needsRoomSync(chatId: string): boolean {
    const room = this.db.query(`select chat_id from room_doc where chat_id = ?`).get(chatId) as {
      chat_id: string;
    } | null;
    if (!room) {
      return true;
    }
    const state = this.db.query(`select dirty from room_query_state where chat_id = ?`).get(chatId) as {
      dirty?: number | null;
    } | null;
    return Number(state?.dirty ?? 0) === 1;
  }

  upsertRoom(channel: MessageChannelRecord): void {
    this.db
      .query(
        `insert into room_doc (chat_id, title, context_id, archived_at, updated_at)
         values (?, ?, ?, ?, ?)
         on conflict(chat_id) do update set
           title = excluded.title,
           context_id = excluded.context_id,
           archived_at = excluded.archived_at,
           updated_at = excluded.updated_at`,
      )
      .run(channel.chatId, channel.title, channel.contextId ?? null, channel.archivedAt ?? null, channel.updatedAt);
    this.db
      .query(
        `update message_doc
         set chat_title = ?, context_id = ?, room_archived_at = ?
         where chat_id = ?`,
      )
      .run(channel.title, channel.contextId ?? null, channel.archivedAt ?? null, channel.chatId);
  }

  markRoomDirty(chatId: string, reason: string): void {
    this.db
      .query(
        `insert into room_query_state (chat_id, dirty, dirty_reason, updated_at)
         values (?, 1, ?, ?)
         on conflict(chat_id) do update set
           dirty = 1,
           dirty_reason = excluded.dirty_reason,
           updated_at = excluded.updated_at`,
      )
      .run(chatId, reason, Date.now());
  }

  clearRoomDirty(chatId: string): void {
    this.db
      .query(
        `insert into room_query_state (chat_id, dirty, dirty_reason, updated_at)
         values (?, 0, null, ?)
         on conflict(chat_id) do update set
           dirty = 0,
           dirty_reason = null,
           updated_at = excluded.updated_at`,
      )
      .run(chatId, Date.now());
  }

  upsertMessage(channel: MessageChannelRecord, message: MessageRecord): void {
    const existing = this.db
      .query(`select doc_id from message_doc where chat_id = ? and message_id = ?`)
      .get(message.chatId, message.messageId) as { doc_id?: number | null } | null;
    const searchText = buildSearchText(channel, message);
    const normalizedContent = message.content.trim().toLowerCase();
    if (existing?.doc_id) {
      this.db
        .query(
          `update message_doc
           set chat_title = ?,
               context_id = ?,
               room_archived_at = ?,
               ref_id = ?,
               sender_actor_id = ?,
               from_id = ?,
               kind = ?,
               content = ?,
               normalized_content = ?,
               search_text = ?,
               created_at = ?,
               updated_at = ?,
               visible_at = ?,
               recalled_at = ?,
               has_attachment = ?,
               attachment_count = ?
           where doc_id = ?`,
        )
        .run(
          channel.title,
          channel.contextId ?? null,
          channel.archivedAt ?? null,
          message.ref ?? null,
          message.senderActorId ?? null,
          message.from,
          message.kind,
          message.content,
          normalizedContent,
          searchText,
          message.createdAt,
          message.updatedAt,
          message.visibleAt ?? null,
          message.recalledAt ?? null,
          toSqliteBoolean((message.attachments?.length ?? 0) > 0),
          message.attachments?.length ?? 0,
          existing.doc_id,
        );
      this.syncFtsRow(existing.doc_id, searchText);
      return;
    }

    const result = this.db
      .query(
        `insert into message_doc (
          chat_id,
          chat_title,
          context_id,
          room_archived_at,
          message_id,
          ref_id,
          sender_actor_id,
          from_id,
          kind,
          content,
          normalized_content,
          search_text,
          created_at,
          updated_at,
          visible_at,
          recalled_at,
          has_attachment,
          attachment_count
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.chatId,
        channel.title,
        channel.contextId ?? null,
        channel.archivedAt ?? null,
        message.messageId,
        message.ref ?? null,
        message.senderActorId ?? null,
        message.from,
        message.kind,
        message.content,
        normalizedContent,
        searchText,
        message.createdAt,
        message.updatedAt,
        message.visibleAt ?? null,
        message.recalledAt ?? null,
        toSqliteBoolean((message.attachments?.length ?? 0) > 0),
        message.attachments?.length ?? 0,
      );
    this.syncFtsRow(Number(result.lastInsertRowid), searchText);
  }

  rebuildRoom(channel: MessageChannelRecord, messages: readonly MessageRecord[]): void {
    const rebuild = this.db.transaction(() => {
      this.upsertRoom(channel);
      const rows = this.db.query(`select doc_id from message_doc where chat_id = ?`).all(channel.chatId) as Array<{
        doc_id: number;
      }>;
      for (const row of rows) {
        this.deleteFtsRow(row.doc_id);
      }
      this.db.query(`delete from message_doc where chat_id = ?`).run(channel.chatId);
      for (const message of messages) {
        this.upsertMessage(channel, message);
      }
      this.clearRoomDirty(channel.chatId);
    });
    rebuild();
  }

  deleteRoom(chatId: string): void {
    const rows = this.db.query(`select doc_id from message_doc where chat_id = ?`).all(chatId) as Array<{
      doc_id: number;
    }>;
    for (const row of rows) {
      this.deleteFtsRow(row.doc_id);
    }
    this.db.query(`delete from message_doc where chat_id = ?`).run(chatId);
    this.db.query(`delete from room_doc where chat_id = ?`).run(chatId);
    this.db.query(`delete from room_query_state where chat_id = ?`).run(chatId);
  }

  queryMessageRefs(input: {
    chatIds: string[];
    mode: Exclude<MessageQueryMode, "sql">;
    query: string;
    offset?: number;
    limit?: number;
  }): MessageQueryDocPage {
    const offset = resolveOffset(input.offset);
    const limit = resolveLimit(input.limit);
    if (input.chatIds.length === 0) {
      return {
        mode: input.mode,
        chatIds: [],
        offset,
        limit,
        nextOffset: null,
        hasMore: false,
        items: [],
      };
    }
    if (input.mode === "match") {
      const term = input.query.trim().toLowerCase();
      if (!term) {
        throw new Error("message query cannot be empty");
      }
      const scope = buildChatScopeSql(input.chatIds);
      const rows = this.db
        .query(
          `select doc.*
           from message_doc as doc
           where ${scope.sql}
             and instr(doc.normalized_content, ?) > 0
           order by doc.created_at desc, doc.message_id desc
           limit ? offset ?`,
        )
        .all(...scope.params, term, limit + 1, offset) as IndexedMessageRow[];
      return this.toDocPage(input.mode, input.chatIds, offset, limit, rows);
    }

    const compiled = compileMessageQuery(input.query);
    const target = offset + limit + 1;
    const batchSize = Math.max(limit * 4, 50);
    const accepted: Array<{ row: IndexedMessageRow; score?: number }> = [];
    let sqlOffset = 0;

    while (accepted.length < target) {
      const batch = this.listStructuredCandidates(
        input.chatIds,
        compiled.candidateFilters,
        compiled.ftsQuery,
        batchSize,
        sqlOffset,
      );
      if (batch.length === 0) {
        break;
      }
      sqlOffset += batch.length;
      for (const candidate of batch) {
        if (compiled.evaluate(mapDocument(candidate.row))) {
          accepted.push(candidate);
          if (accepted.length >= target) {
            break;
          }
        }
      }
    }

    const pageItems = accepted.slice(offset, offset + limit + 1);
    const hasMore = pageItems.length > limit;
    const items = pageItems.slice(0, limit).map(({ row, score }) => ({
      chatId: row.chat_id,
      chatTitle: row.chat_title,
      contextId: row.context_id ?? undefined,
      messageId: row.message_id,
      score,
    }));

    return {
      mode: input.mode,
      chatIds: [...input.chatIds],
      offset,
      limit,
      nextOffset: hasMore ? offset + limit : null,
      hasMore,
      items,
    };
  }

  querySql(input: { chatIds: string[]; query: string; offset?: number; limit?: number }): MessageQuerySqlResult {
    const offset = resolveOffset(input.offset);
    const limit = resolveLimit(input.limit);
    const normalizedSql = assertReadOnlyMessageQuerySql(input.query);
    const sqlDb = new Database(":memory:", { strict: true });
    sqlDb.exec(`pragma journal_mode = OFF;`);
    sqlDb.exec(`pragma synchronous = OFF;`);
    sqlDb.exec(`
      create table rooms (
        chat_id text primary key,
        title text not null,
        context_id text,
        archived_at integer,
        updated_at integer not null
      );
      create table messages (
        chat_id text not null,
        chat_title text not null,
        context_id text,
        room_archived_at integer,
        message_id integer not null,
        ref_id integer,
        sender_actor_id text,
        from_id text not null,
        kind text not null,
        content text not null,
        normalized_content text not null,
        search_text text not null,
        created_at integer not null,
        updated_at integer not null,
        visible_at integer,
        recalled_at integer,
        has_attachment integer not null,
        attachment_count integer not null
      );
      create index idx_message_query_sql_chat_created on messages(chat_id, created_at desc, message_id desc);
      create index idx_message_query_sql_sender on messages(sender_actor_id, created_at desc);
      create index idx_message_query_sql_context on messages(context_id, created_at desc);
    `);

    try {
      if (input.chatIds.length > 0) {
        const placeholders = input.chatIds.map(() => "?").join(", ");
        const rooms = this.db
          .query(
            `select chat_id, title, context_id, archived_at, updated_at
             from room_doc
             where chat_id in (${placeholders})
             order by updated_at desc, chat_id asc`,
          )
          .all(...input.chatIds) as IndexedRoomRow[];
        const messages = this.db
          .query(
            `select *
             from message_doc
             where chat_id in (${placeholders})
             order by created_at desc, message_id desc`,
          )
          .all(...input.chatIds) as IndexedMessageRow[];
        const insertRoom = sqlDb.query(
          `insert into rooms (chat_id, title, context_id, archived_at, updated_at) values (?, ?, ?, ?, ?)`,
        );
        const insertMessage = sqlDb.query(
          `insert into messages (
            chat_id,
            chat_title,
            context_id,
            room_archived_at,
            message_id,
            ref_id,
            sender_actor_id,
            from_id,
            kind,
            content,
            normalized_content,
            search_text,
            created_at,
            updated_at,
            visible_at,
            recalled_at,
            has_attachment,
            attachment_count
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        const hydrate = sqlDb.transaction(() => {
          for (const room of rooms) {
            insertRoom.run(room.chat_id, room.title, room.context_id, room.archived_at, room.updated_at);
          }
          for (const message of messages) {
            insertMessage.run(
              message.chat_id,
              message.chat_title,
              message.context_id,
              message.room_archived_at,
              message.message_id,
              message.ref_id,
              message.sender_actor_id,
              message.from_id,
              message.kind,
              message.content,
              message.normalized_content,
              message.search_text,
              message.created_at,
              message.updated_at,
              message.visible_at,
              message.recalled_at,
              message.has_attachment,
              message.attachment_count,
            );
          }
        });
        hydrate();
      }

      const paginatedSql = `select * from (${normalizedSql}) as message_query_sql limit ? offset ?`;
      const statement = sqlDb.query(paginatedSql);
      const rawRows = statement.all(limit + 1, offset) as Array<Record<string, unknown>>;
      const hasMore = rawRows.length > limit;
      const rows = rawRows.slice(0, limit).map(normalizeMessageQueryRow);
      return {
        resultKind: "sql",
        mode: "sql",
        chatIds: [...input.chatIds],
        offset,
        limit,
        nextOffset: hasMore ? offset + limit : null,
        hasMore,
        columns: [...statement.columnNames],
        rows,
      };
    } finally {
      sqlDb.close();
    }
  }

  private initializeSchema(): boolean {
    const userVersionRow = this.db.query(`pragma user_version`).get() as { user_version?: number } | null;
    const currentSchemaVersion = userVersionRow?.user_version ?? 0;
    const hasLegacyTables =
      this.hasTable("room_doc") || this.hasTable("message_doc") || this.hasTable("room_query_state");
    if (currentSchemaVersion < MESSAGE_QUERY_DB_BREAKING_RESET_VERSION && hasLegacyTables) {
      this.db.exec(`
        drop table if exists message_fts;
        drop table if exists message_doc;
        drop table if exists room_query_state;
        drop table if exists room_doc;
      `);
    }
    this.db.exec(`
      create table if not exists room_doc (
        chat_id text primary key,
        title text not null,
        context_id text,
        archived_at integer,
        updated_at integer not null
      );

      create table if not exists message_doc (
        doc_id integer primary key autoincrement,
        chat_id text not null,
        chat_title text not null,
        context_id text,
        room_archived_at integer,
        message_id integer not null,
        ref_id integer,
        sender_actor_id text,
        from_id text not null,
        kind text not null,
        content text not null,
        normalized_content text not null,
        search_text text not null,
        created_at integer not null,
        updated_at integer not null,
        visible_at integer,
        recalled_at integer,
        has_attachment integer not null default 0,
        attachment_count integer not null default 0,
        unique(chat_id, message_id)
      );

      create table if not exists room_query_state (
        chat_id text primary key,
        dirty integer not null default 0,
        dirty_reason text,
        updated_at integer not null
      );

      create index if not exists idx_message_doc_chat_created on message_doc(chat_id, created_at desc, message_id desc);
      create index if not exists idx_message_doc_sender on message_doc(sender_actor_id, created_at desc, message_id desc);
      create index if not exists idx_message_doc_context on message_doc(context_id, created_at desc, message_id desc);
      create index if not exists idx_message_doc_kind on message_doc(kind, created_at desc, message_id desc);
    `);

    try {
      this.db.exec(`
        create virtual table if not exists message_fts using fts5(
          search_text,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);
      this.db.exec(`pragma user_version = ${MESSAGE_QUERY_DB_SCHEMA_VERSION};`);
      return true;
    } catch {
      this.db.exec(`drop table if exists message_fts;`);
      this.db.exec(`pragma user_version = ${MESSAGE_QUERY_DB_SCHEMA_VERSION};`);
      return false;
    }
  }

  private hasTable(name: string): boolean {
    const row = this.db.query(`select name from sqlite_master where type = 'table' and name = ?`).get(name) as
      | { name?: string }
      | null;
    return row?.name === name;
  }

  private syncFtsRow(docId: number, searchText: string): void {
    if (!this.ftsEnabled) {
      return;
    }
    this.deleteFtsRow(docId);
    this.db.query(`insert into message_fts(rowid, search_text) values (?, ?)`).run(docId, searchText);
  }

  private deleteFtsRow(docId: number): void {
    if (!this.ftsEnabled) {
      return;
    }
    this.db.query(`delete from message_fts where rowid = ?`).run(docId);
  }

  private listStructuredCandidates(
    chatIds: readonly string[],
    filters: readonly MessageQueryCandidateFilter[],
    ftsQuery: string | null,
    limit: number,
    offset: number,
  ): Array<{ row: IndexedMessageRow; score?: number }> {
    const scope = buildChatScopeSql(chatIds);
    const filterParts = filters.map(buildCandidateFilterSql);
    const filterSql = filterParts.map((entry) => entry.sql);
    const filterParams = filterParts.flatMap((entry) => entry.params);

    if (this.ftsEnabled && ftsQuery) {
      const rows = this.db
        .query(
          `select doc.*, -bm25(message_fts) as score
           from message_fts
           join message_doc as doc on doc.doc_id = message_fts.rowid
           where message_fts match ?
             and ${scope.sql}
             ${filterSql.length > 0 ? `and ${filterSql.join(" and ")}` : ""}
           order by score desc, doc.created_at desc, doc.message_id desc
           limit ? offset ?`,
        )
        .all(ftsQuery, ...scope.params, ...filterParams, limit, offset) as Array<IndexedMessageRow & { score: number }>;
      return rows.map((row) => ({ row, score: row.score }));
    }

    const rows = this.db
      .query(
        `select doc.*
         from message_doc as doc
         where ${scope.sql}
           ${filterSql.length > 0 ? `and ${filterSql.join(" and ")}` : ""}
         order by doc.created_at desc, doc.message_id desc
         limit ? offset ?`,
      )
      .all(...scope.params, ...filterParams, limit, offset) as IndexedMessageRow[];
    return rows.map((row) => ({ row }));
  }

  private toDocPage(
    mode: Exclude<MessageQueryMode, "sql">,
    chatIds: string[],
    offset: number,
    limit: number,
    rows: IndexedMessageRow[],
  ): MessageQueryDocPage {
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      chatId: row.chat_id,
      chatTitle: row.chat_title,
      contextId: row.context_id ?? undefined,
      messageId: row.message_id,
    }));
    return {
      mode,
      chatIds: [...chatIds],
      offset,
      limit,
      nextOffset: hasMore ? offset + limit : null,
      hasMore,
      items,
    };
  }
}
