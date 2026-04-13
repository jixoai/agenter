import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { PROMPT_WINDOW_STATE_PART_TYPE } from "./types";
import type {
  ReversePage,
  ReverseTimeCursor,
  SessionAiCallInsert,
  SessionAiCallRecord,
  SessionAiCallUpdate,
  SessionAssetInsert,
  SessionAssetRecord,
  SessionHeadRecord,
  SessionMessagePartRecord,
  SessionMessageRecord,
  SessionMessageScope,
  SessionMessageUpsertInput,
  SessionPromptWindowRecord,
} from "./types";

const SESSION_DB_SCHEMA_VERSION = 1;

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

const isBeforeCursor = (
  input: { createdAt: number; id: number },
  before: ReverseTimeCursor | undefined,
): boolean =>
  before === undefined ||
  input.createdAt < before.beforeTimeMs ||
  (input.createdAt === before.beforeTimeMs && input.id < before.beforeId);

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

interface StoredMessageEnvelope {
  id: number;
  message_id: string;
  window_id: string | null;
  ai_call_id: number | null;
  round_index: number;
  scope: SessionMessageScope;
  role: SessionMessageRecord["role"];
  created_at: number;
  updated_at: number;
}

export class SessionDb {
  private readonly db: Database;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.migrate();
    this.ensureHeadRow();
  }

  close(): void {
    this.db.close();
  }

  getHead(): SessionHeadRecord {
    const row = this.db
      .query(
        `select current_round_index, current_prompt_window_id, updated_at
         from session_head
         where id = 1`,
      )
      .get() as
      | {
          current_round_index: number;
          current_prompt_window_id: string | null;
          updated_at: number;
        }
      | null;
    return {
      currentRoundIndex: row?.current_round_index ?? 0,
      currentPromptWindowId: row?.current_prompt_window_id ?? null,
      updatedAt: row?.updated_at ?? Date.now(),
    };
  }

  setCurrentRoundIndex(currentRoundIndex: number, updatedAt = Date.now()): SessionHeadRecord {
    this.db
      .query(`update session_head set current_round_index = ?, updated_at = ? where id = 1`)
      .run(currentRoundIndex, updatedAt);
    return this.getHead();
  }

  bumpRound(updatedAt = Date.now()): SessionHeadRecord {
    const next = this.getHead().currentRoundIndex + 1;
    return this.setCurrentRoundIndex(next, updatedAt);
  }

  setCurrentPromptWindow(promptWindowId: string | null, updatedAt = Date.now()): SessionHeadRecord {
    this.db
      .query(`update session_head set current_prompt_window_id = ?, updated_at = ? where id = 1`)
      .run(promptWindowId, updatedAt);
    return this.getHead();
  }

  savePromptWindow(input: {
    createdAt?: number;
    roundIndex?: number;
    messages: unknown[];
    setCurrent?: boolean;
  }): SessionPromptWindowRecord {
    const createdAt = input.createdAt ?? Date.now();
    const promptWindowId = createId();
    const roundIndex = input.roundIndex ?? this.getHead().currentRoundIndex;
    if (input.messages.length === 0) {
      this.upsertMessage({
        messageId: `${promptWindowId}:state`,
        windowId: promptWindowId,
        roundIndex,
        scope: "prompt_window",
        role: "system",
        createdAt,
        updatedAt: createdAt,
        parts: [
          {
            partType: PROMPT_WINDOW_STATE_PART_TYPE,
            payload: {
              messages: [],
            },
            isComplete: true,
          },
        ],
      });
    } else {
      input.messages.forEach((message, index) => {
        const normalized =
          message && typeof message === "object"
            ? (message as { role?: string; content?: unknown })
            : { role: undefined, content: message };
        const role =
          normalized.role === "assistant" || normalized.role === "system" || normalized.role === "tool"
            ? normalized.role
            : "user";
        this.upsertMessage({
          messageId: `${promptWindowId}:message:${index}`,
          windowId: promptWindowId,
          roundIndex,
          scope: "prompt_window",
          role,
          createdAt,
          updatedAt: createdAt,
          parts: [
            {
              partType: "message",
              payload: {
                content: normalized.content ?? "",
              },
              isComplete: true,
            },
          ],
        });
      });
    }
    if (input.setCurrent ?? true) {
      this.setCurrentPromptWindow(promptWindowId, createdAt);
    }
    return {
      promptWindowId,
      roundIndex,
      createdAt,
      messages: structuredClone(input.messages),
    };
  }

  getPromptWindow(promptWindowId: string): SessionPromptWindowRecord | null {
    const messages = this.listMessagesByScope("prompt_window", { windowId: promptWindowId });
    if (messages.length === 0) {
      return null;
    }
    const promptMessages = messages.filter((message) => !this.isPromptWindowStateMessage(message));
    return {
      promptWindowId,
      roundIndex: messages[0]!.roundIndex,
      createdAt: messages[0]!.createdAt,
      messages: promptMessages.map((message) => ({
        role: message.role,
        content: this.messageToPromptContent(message),
      })),
    };
  }

  getCurrentPromptWindow(): SessionPromptWindowRecord | null {
    const promptWindowId = this.getHead().currentPromptWindowId;
    if (!promptWindowId) {
      return null;
    }
    return this.getPromptWindow(promptWindowId);
  }

  upsertMessage(input: SessionMessageUpsertInput): SessionMessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const existing = this.db
      .query(
        `select part_id, part_index
         from message_part
         where message_id = ?
         order by part_index asc`,
      )
      .all(input.messageId) as Array<{ part_id: number; part_index: number }>;

    this.db.exec("begin immediate");
    try {
      for (const [index, part] of input.parts.entries()) {
        const existingRow = existing[index];
        if (existingRow) {
          this.db
            .query(
              `update message_part
               set window_id = ?,
                   ai_call_id = ?,
                   round_index = ?,
                   scope = ?,
                   role = ?,
                   part_type = ?,
                   mime_type = ?,
                   payload_json = ?,
                   created_at = ?,
                   updated_at = ?,
                   is_complete = ?
               where part_id = ?`,
            )
            .run(
              input.windowId ?? null,
              input.aiCallId ?? null,
              input.roundIndex,
              input.scope,
              input.role,
              part.partType,
              part.mimeType ?? null,
              toJson(part.payload),
              createdAt,
              updatedAt,
              (part.isComplete ?? true) ? 1 : 0,
              existingRow.part_id,
            );
        } else {
          this.db
            .query(
               `insert into message_part (
                 part_index,
                 message_id,
                 window_id,
                 ai_call_id,
                 round_index,
                 scope,
                 role,
                 part_type,
                 mime_type,
                 payload_json,
                 created_at,
                 updated_at,
                 is_complete
               ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              index,
              input.messageId,
              input.windowId ?? null,
              input.aiCallId ?? null,
              input.roundIndex,
              input.scope,
              input.role,
              part.partType,
              part.mimeType ?? null,
              toJson(part.payload),
              createdAt,
              updatedAt,
              (part.isComplete ?? true) ? 1 : 0,
            );
        }
      }
      for (const extra of existing.slice(input.parts.length)) {
        this.db.query(`delete from message_part where part_id = ?`).run(extra.part_id);
      }
      this.db.exec("commit");
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
    const record = this.getMessageById(input.messageId);
    if (!record) {
      throw new Error(`failed to load message ${input.messageId}`);
    }
    return record;
  }

  getMessageById(messageId: string): SessionMessageRecord | null {
    const rows = this.db
      .query(
        `select part_id, part_index, message_id, window_id, ai_call_id, round_index, scope, role,
                part_type, mime_type, payload_json, created_at, updated_at, is_complete
         from message_part
         where message_id = ?
         order by part_index asc, part_id asc`,
      )
      .all(messageId) as Array<{
      part_id: number;
      part_index: number;
      message_id: string;
      window_id: string | null;
      ai_call_id: number | null;
      round_index: number;
      scope: SessionMessageScope;
      role: SessionMessageRecord["role"];
      part_type: string;
      mime_type: string | null;
      payload_json: string;
      created_at: number;
      updated_at: number;
      is_complete: number;
    }>;
    if (rows.length === 0) {
      return null;
    }
    const parts: SessionMessagePartRecord[] = rows.map((row) => ({
      partId: row.part_id,
      partIndex: row.part_index,
      messageId: row.message_id,
      windowId: row.window_id,
      aiCallId: row.ai_call_id,
      roundIndex: row.round_index,
      scope: row.scope,
      role: row.role,
      partType: row.part_type,
      mimeType: row.mime_type,
      payload: parseJson(row.payload_json, null),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isComplete: row.is_complete === 1,
    }));
    const first = parts[0]!;
    return {
      id: first.partId,
      messageId: first.messageId,
      windowId: first.windowId,
      aiCallId: first.aiCallId,
      roundIndex: first.roundIndex,
      scope: first.scope,
      role: first.role,
      createdAt: first.createdAt,
      updatedAt: Math.max(...parts.map((part) => part.updatedAt)),
      isComplete: parts.every((part) => part.isComplete),
      parts,
      text: parts.map((part) => this.partPayloadToText(part.payload)).join(""),
    };
  }

  listMessagesByScope(
    scope: SessionMessageScope,
    input?: { windowId?: string | null; before?: ReverseTimeCursor; limit?: number },
  ): SessionMessageRecord[] {
    return this.listMessagesByScopes([scope], input);
  }

  listMessagesByScopes(
    scopes: readonly SessionMessageScope[],
    input?: { windowId?: string | null; before?: ReverseTimeCursor; limit?: number },
  ): SessionMessageRecord[] {
    const limit = resolvePageLimit(input?.limit);
    const before = input?.before;
    const rows = this.queryMessageEnvelopesByScopes(scopes, input?.windowId ?? undefined);
    const filteredDescending = rows
      .sort((left, right) => (left.created_at === right.created_at ? right.id - left.id : right.created_at - left.created_at))
      .filter((row) => isBeforeCursor({ createdAt: row.created_at, id: row.id }, before))
      .slice(0, limit)
      .reverse();
    return filteredDescending
      .map((row) => this.getMessageById(row.message_id))
      .filter((row): row is SessionMessageRecord => row !== null);
  }

  pageMessagesByScope(
    scope: SessionMessageScope,
    input?: { windowId?: string | null; before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    return this.pageMessagesByScopes([scope], input);
  }

  pageMessagesByScopes(
    scopes: readonly SessionMessageScope[],
    input?: { windowId?: string | null; before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    const limit = resolvePageLimit(input?.limit);
    const before = input?.before;
    const envelopesDescending = this.queryMessageEnvelopesByScopes(scopes, input?.windowId ?? undefined).sort(
      (left, right) => (left.created_at === right.created_at ? right.id - left.id : right.created_at - left.created_at),
    );
    const filteredDescending = envelopesDescending.filter((row) =>
      isBeforeCursor({ createdAt: row.created_at, id: row.id }, before),
    );
    const pageDescending = filteredDescending.slice(0, limit);
    const itemsDescending = pageDescending
      .map((row) => this.getMessageById(row.message_id))
      .filter((row): row is SessionMessageRecord => row !== null)
      .reverse();
    const nextCursorSource =
      filteredDescending.length > pageDescending.length ? pageDescending.at(-1) ?? null : null;
    return {
      items: itemsDescending,
      nextBefore: nextCursorSource
        ? {
            beforeTimeMs: nextCursorSource.created_at,
            beforeId: nextCursorSource.id,
          }
        : null,
      hasMoreBefore: filteredDescending.length > pageDescending.length,
    };
  }

  appendAiCall(input: SessionAiCallInsert): SessionAiCallRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const result = this.db
      .query(
        `insert into ai_call (
           round_index,
           kind,
           status,
           provider,
           model,
           request_url,
           request_body_json,
           response_body_json,
           error_json,
           outcome_json,
           request_message_ids_json,
           response_message_ids_json,
           auxiliary_message_ids_json,
           created_at,
           updated_at,
           completed_at,
           is_complete
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.roundIndex,
        input.kind,
        input.status ?? "running",
        input.provider,
        input.model,
        input.requestUrl,
        toJson(input.requestBody),
        input.responseBody === undefined ? null : toJson(input.responseBody),
        input.error === undefined ? null : toJson(input.error),
        input.outcome === undefined ? null : toJson(input.outcome),
        toJson(input.requestMessageIds ?? []),
        toJson(input.responseMessageIds ?? []),
        toJson(input.auxiliaryMessageIds ?? []),
        createdAt,
        updatedAt,
        input.completedAt ?? null,
        input.isComplete ?? false ? 1 : 0,
      );
    const record = this.getAiCallById(Number(result.lastInsertRowid));
    if (!record) {
      throw new Error("failed to load inserted ai_call");
    }
    return record;
  }

  getAiCallById(id: number): SessionAiCallRecord | null {
    const row = this.db
      .query(
        `select id, round_index, kind, status, provider, model, request_url, request_body_json, response_body_json,
                error_json, outcome_json, request_message_ids_json, response_message_ids_json, auxiliary_message_ids_json,
                created_at, updated_at, completed_at, is_complete
         from ai_call
         where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          round_index: number;
          kind: string;
          status: SessionAiCallRecord["status"];
          provider: string;
          model: string;
          request_url: string;
          request_body_json: string;
          response_body_json: string | null;
          error_json: string | null;
          outcome_json: string | null;
          request_message_ids_json: string;
          response_message_ids_json: string;
          auxiliary_message_ids_json: string;
          created_at: number;
          updated_at: number;
          completed_at: number | null;
          is_complete: number;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      roundIndex: row.round_index,
      kind: row.kind,
      status: row.status,
      provider: row.provider,
      model: row.model,
      requestUrl: row.request_url,
      requestBody: parseJson(row.request_body_json, null),
      responseBody: row.response_body_json === null ? null : parseJson(row.response_body_json, null),
      error: row.error_json === null ? null : parseJson(row.error_json, null),
      outcome: row.outcome_json === null ? null : parseJson(row.outcome_json, null),
      requestMessageIds: parseJson(row.request_message_ids_json, []),
      responseMessageIds: parseJson(row.response_message_ids_json, []),
      auxiliaryMessageIds: parseJson(row.auxiliary_message_ids_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      isComplete: row.is_complete === 1,
    };
  }

  updateAiCall(id: number, input: SessionAiCallUpdate): SessionAiCallRecord {
    const current = this.getAiCallById(id);
    if (!current) {
      throw new Error(`ai_call not found: ${id}`);
    }
    this.db
      .query(
        `update ai_call
         set round_index = ?,
             kind = ?,
             status = ?,
             provider = ?,
             model = ?,
             request_url = ?,
             request_body_json = ?,
             response_body_json = ?,
             error_json = ?,
             outcome_json = ?,
             request_message_ids_json = ?,
             response_message_ids_json = ?,
             auxiliary_message_ids_json = ?,
             updated_at = ?,
             completed_at = ?,
             is_complete = ?
         where id = ?`,
      )
      .run(
        input.roundIndex ?? current.roundIndex,
        input.kind ?? current.kind,
        input.status ?? current.status,
        input.provider ?? current.provider,
        input.model ?? current.model,
        input.requestUrl ?? current.requestUrl,
        toJson(input.requestBody ?? current.requestBody),
        toJson(input.responseBody === undefined ? current.responseBody : input.responseBody),
        toJson(input.error === undefined ? current.error : input.error),
        toJson(input.outcome === undefined ? current.outcome : input.outcome),
        toJson(input.requestMessageIds ?? current.requestMessageIds),
        toJson(input.responseMessageIds ?? current.responseMessageIds),
        toJson(input.auxiliaryMessageIds ?? current.auxiliaryMessageIds),
        input.updatedAt ?? Date.now(),
        input.completedAt === undefined ? current.completedAt : input.completedAt,
        input.isComplete === undefined ? current.isComplete : input.isComplete ? 1 : 0,
        id,
      );
    const record = this.getAiCallById(id);
    if (!record) {
      throw new Error(`failed to load updated ai_call ${id}`);
    }
    return record;
  }

  listAiCalls(limit = 200): SessionAiCallRecord[] {
    const rows = this.db
      .query(`select id from ai_call order by created_at desc, id desc limit ?`)
      .all(resolvePageLimit(limit)) as Array<{ id: number }>;
    return rows
      .reverse()
      .map((row) => this.getAiCallById(row.id))
      .filter((row): row is SessionAiCallRecord => row !== null);
  }

  listAiCallsAfter(afterId = 0, limit = 200): SessionAiCallRecord[] {
    const rows = this.db
      .query(`select id from ai_call where id > ? order by id asc limit ?`)
      .all(afterId, resolvePageLimit(limit)) as Array<{ id: number }>;
    return rows.map((row) => this.getAiCallById(row.id)).filter((row): row is SessionAiCallRecord => row !== null);
  }

  listAiCallsBefore(beforeId: number, limit = 200): SessionAiCallRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const rows = this.db
      .query(`select id from ai_call where id < ? order by id desc limit ?`)
      .all(beforeId, resolvePageLimit(limit)) as Array<{ id: number }>;
    return rows
      .reverse()
      .map((row) => this.getAiCallById(row.id))
      .filter((row): row is SessionAiCallRecord => row !== null);
  }

  pageAiCalls(input?: { before?: ReverseTimeCursor; limit?: number }): ReversePage<SessionAiCallRecord> {
    const limit = resolvePageLimit(input?.limit);
    const before = input?.before;
    const rowsDescending = (this.db
      .query(`select id, created_at from ai_call order by created_at desc, id desc`)
      .all() as Array<{ id: number; created_at: number }>).filter((row) =>
      isBeforeCursor({ createdAt: row.created_at, id: row.id }, before),
    );
    const pageDescending = rowsDescending.slice(0, limit);
    const itemsDescending = pageDescending
      .map((row) => this.getAiCallById(row.id))
      .filter((row): row is SessionAiCallRecord => row !== null)
      .reverse();
    const nextCursorSource = rowsDescending.length > pageDescending.length ? pageDescending.at(-1) ?? null : null;
    return {
      items: itemsDescending,
      nextBefore: nextCursorSource
        ? {
            beforeTimeMs: nextCursorSource.created_at,
            beforeId: nextCursorSource.id,
          }
        : null,
      hasMoreBefore: rowsDescending.length > pageDescending.length,
    };
  }

  pruneAiCallsBeforeRound(minRoundIndex: number): void {
    this.db.query(`delete from ai_call where round_index < ?`).run(minRoundIndex);
  }

  appendAsset(input: SessionAssetInsert): SessionAssetRecord {
    const createdAt = input.createdAt ?? Date.now();
    this.db
      .query(
        `insert or replace into session_asset (
           id,
           kind,
           created_at,
           name,
           mime_type,
           size_bytes,
           relative_path
         ) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.id, input.kind, createdAt, input.name, input.mimeType, input.sizeBytes, input.relativePath);
    const record = this.getAssetById(input.id);
    if (!record) {
      throw new Error(`failed to load asset ${input.id}`);
    }
    return record;
  }

  getAssetById(id: string): SessionAssetRecord | null {
    const row = this.db
      .query(
        `select id, kind, created_at, name, mime_type, size_bytes, relative_path
         from session_asset
         where id = ?`,
      )
      .get(id) as
      | {
          id: string;
          kind: SessionAssetRecord["kind"];
          created_at: number;
          name: string;
          mime_type: string;
          size_bytes: number;
          relative_path: string;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      kind: row.kind,
      createdAt: row.created_at,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      relativePath: row.relative_path,
    };
  }

  listAssetsByIds(ids: string[]): SessionAssetRecord[] {
    return ids.map((id) => this.getAssetById(id)).filter((row): row is SessionAssetRecord => row !== null);
  }

  getLatestAuxiliaryMessage(partType: string): SessionMessageRecord | null {
    const row = this.db
      .query(
        `select message_id
         from message_part
         where scope = 'request_aux' and part_type = ?
         order by created_at desc, part_id desc
         limit 1`,
      )
      .get(partType) as { message_id: string } | null;
    return row ? this.getMessageById(row.message_id) : null;
  }

  private queryMessageEnvelopes(scope: SessionMessageScope, windowId?: string): StoredMessageEnvelope[] {
    return this.queryMessageEnvelopesByScopes([scope], windowId);
  }

  private queryMessageEnvelopesByScopes(
    scopes: readonly SessionMessageScope[],
    windowId?: string,
  ): StoredMessageEnvelope[] {
    if (scopes.length === 0) {
      return [];
    }
    const scopePlaceholders = scopes.map(() => "?").join(", ");
    const rows = this.db
      .query(
        `select min(part_id) as id,
                message_id,
                window_id,
                ai_call_id,
                round_index,
                scope,
                role,
                min(created_at) as created_at,
                max(updated_at) as updated_at
         from message_part
         where scope in (${scopePlaceholders})
           and (? is null or window_id = ?)
         group by message_id, window_id, ai_call_id, round_index, scope, role`,
      )
      .all(...scopes, windowId ?? null, windowId ?? null) as StoredMessageEnvelope[];
    return rows;
  }

  private partPayloadToText(payload: unknown): string {
    if (typeof payload === "string") {
      return payload;
    }
    if (payload && typeof payload === "object") {
      if ("content" in payload && typeof payload.content === "string") {
        return payload.content;
      }
      if ("text" in payload && typeof payload.text === "string") {
        return payload.text;
      }
    }
    return typeof payload === "undefined" ? "" : JSON.stringify(payload);
  }

  private messageToPromptContent(message: SessionMessageRecord): unknown {
    if (message.parts.length === 1) {
      const payload = message.parts[0]?.payload;
      if (payload && typeof payload === "object" && !Array.isArray(payload) && "content" in payload) {
        return structuredClone((payload as { content: unknown }).content);
      }
      return structuredClone(payload);
    }
    return message.parts.map((part) => structuredClone(part.payload));
  }

  private isPromptWindowStateMessage(message: SessionMessageRecord): boolean {
    return message.parts.length === 1 && message.parts[0]?.partType === PROMPT_WINDOW_STATE_PART_TYPE;
  }

  private ensureHeadRow(): void {
    const existing = this.db.query(`select id from session_head where id = 1`).get() as { id: number } | null;
    if (!existing) {
      this.db
        .query(
          `insert into session_head (id, current_round_index, current_prompt_window_id, updated_at)
           values (1, 0, null, ?)`,
        )
        .run(Date.now());
    }
  }

  private migrate(): void {
    const currentVersion =
      (this.db.query(`pragma user_version`).get() as { user_version?: number } | null)?.user_version ?? 0;
    if (currentVersion !== SESSION_DB_SCHEMA_VERSION) {
      this.db.exec(`
        drop table if exists session_head;
        drop table if exists message_part;
        drop table if exists ai_call;
        drop table if exists session_asset;
        drop table if exists session_cycle;
        drop table if exists prompt_window_state;
        drop table if exists model_call;
        drop table if exists api_call;
        drop table if exists session_block;
        drop table if exists loopbus_state_log;
        drop table if exists loopbus_trace;
        drop table if exists terminal_activity;
      `);
    }
    this.db.exec(`
      create table if not exists session_head (
        id integer primary key check (id = 1),
        current_round_index integer not null default 0,
        current_prompt_window_id text,
        updated_at integer not null
      );

      create table if not exists message_part (
        part_id integer primary key autoincrement,
        part_index integer not null,
        message_id text not null,
        window_id text,
        ai_call_id integer,
        round_index integer not null,
        scope text not null,
        role text not null,
        part_type text not null,
        mime_type text,
        payload_json text not null,
        created_at integer not null,
        updated_at integer not null,
        is_complete integer not null default 0
      );
      create unique index if not exists idx_message_part_message_index
        on message_part(message_id, part_index);
      create index if not exists idx_message_part_scope_created
        on message_part(scope, created_at desc, part_id desc);
      create index if not exists idx_message_part_window
        on message_part(window_id, created_at asc, part_id asc);
      create index if not exists idx_message_part_ai_call
        on message_part(ai_call_id, part_id asc);

      create table if not exists ai_call (
        id integer primary key autoincrement,
        round_index integer not null,
        kind text not null,
        status text not null,
        provider text not null,
        model text not null,
        request_url text not null,
        request_body_json text not null,
        response_body_json text,
        error_json text,
        outcome_json text,
        request_message_ids_json text not null,
        response_message_ids_json text not null,
        auxiliary_message_ids_json text not null,
        created_at integer not null,
        updated_at integer not null,
        completed_at integer,
        is_complete integer not null default 0
      );
      create index if not exists idx_ai_call_created
        on ai_call(created_at desc, id desc);
      create index if not exists idx_ai_call_round
        on ai_call(round_index desc, id desc);

      create table if not exists session_asset (
        id text primary key,
        kind text not null,
        created_at integer not null,
        name text not null,
        mime_type text not null,
        size_bytes integer not null,
        relative_path text not null
      );
    `);
    this.db.exec(`pragma user_version = ${SESSION_DB_SCHEMA_VERSION}`);
  }
}
