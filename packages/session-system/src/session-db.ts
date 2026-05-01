import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import type {
  ReversePage,
  ReverseTimeCursor,
  SessionAiCallInsert,
  SessionAiCallRecord,
  SessionAiCallUpdate,
  SessionAssetInsert,
  SessionAssetRecord,
  SessionAttentionDispatchInsert,
  SessionAttentionDispatchRecord,
  SessionEffectLedgerInsert,
  SessionEffectLedgerRecord,
  SessionNotifyQuotaInsert,
  SessionNotifyQuotaRecord,
  SessionAttentionReceiptInsert,
  SessionAttentionReceiptProviderEventKind,
  SessionAttentionReceiptRecord,
  SessionAttentionReceiptStatus,
  SessionHeadRecord,
  SessionMessagePartRecord,
  SessionMessageRecord,
  SessionMessageScope,
  SessionMessageUpsertInput,
  SessionPromptWindowRecord,
  SessionRuntimeWatchInsert,
  SessionRuntimeWatchRecord,
  SessionRuntimeWatchStatus,
  SessionRuntimeWatchUpdate,
} from "./types";
import { PROMPT_WINDOW_STATE_PART_TYPE } from "./types";

const SESSION_DB_SCHEMA_VERSION = 4;

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

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

interface StoredMessageHeadRow {
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

/**
 * SessionDb is the AI-call historian.
 *
 * It records objective facts around provider calls, message parts, dispatches,
 * and receipts for inspection and reconstruction. Room, terminal, workspace,
 * and attention business truth still belongs to their owning systems.
 */
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
      .get() as {
      current_round_index: number;
      current_prompt_window_id: string | null;
      updated_at: number;
    } | null;
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

  listMessagesByIds(messageIds: readonly string[]): SessionMessageRecord[] {
    return messageIds
      .map((messageId) => this.getMessageById(messageId))
      .filter((message): message is SessionMessageRecord => message !== null);
  }

  listMessagesByScopesAndAiCallIds(
    scopes: readonly SessionMessageScope[],
    aiCallIds: readonly number[],
  ): SessionMessageRecord[] {
    if (scopes.length === 0 || aiCallIds.length === 0) {
      return [];
    }
    return this.queryMessageHeadRowsByScopes(scopes, {
      aiCallIds,
      order: "asc",
    })
      .map((row) => this.getMessageById(row.message_id))
      .filter((message): message is SessionMessageRecord => message !== null);
  }

  listMessagesByScopesWithNullAiCallInRange(
    scopes: readonly SessionMessageScope[],
    input?: {
      afterCreatedAt?: number;
      afterInclusive?: boolean;
      beforeCreatedAt?: number;
      beforeInclusive?: boolean;
    },
  ): SessionMessageRecord[] {
    if (scopes.length === 0) {
      return [];
    }
    return this.queryMessageHeadRowsByScopes(scopes, {
      onlyNullAiCall: true,
      afterCreatedAt: input?.afterCreatedAt,
      afterInclusive: input?.afterInclusive,
      beforeCreatedAt: input?.beforeCreatedAt,
      beforeInclusive: input?.beforeInclusive,
      order: "asc",
    })
      .map((row) => this.getMessageById(row.message_id))
      .filter((message): message is SessionMessageRecord => message !== null);
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
    const rowsDescending = this.queryMessageHeadRowsByScopes(scopes, {
      windowId: input?.windowId ?? undefined,
      before: input?.before,
      limit: input?.limit,
      order: "desc",
    });
    return rowsDescending
      .reverse()
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
    const rowsDescending = this.queryMessageHeadRowsByScopes(scopes, {
      windowId: input?.windowId ?? undefined,
      before: input?.before,
      limit: limit + 1,
      order: "desc",
    });
    const hasMoreBefore = rowsDescending.length > limit;
    const pageDescending = rowsDescending.slice(0, limit);
    const itemsDescending = pageDescending
      .map((row) => this.getMessageById(row.message_id))
      .filter((row): row is SessionMessageRecord => row !== null)
      .reverse();
    const nextCursorSource = hasMoreBefore ? (pageDescending.at(-1) ?? null) : null;
    return {
      items: itemsDescending,
      nextBefore: nextCursorSource
        ? {
            beforeTimeMs: nextCursorSource.created_at,
            beforeId: nextCursorSource.id,
          }
        : null,
      hasMoreBefore,
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
        (input.isComplete ?? false) ? 1 : 0,
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
      .get(id) as {
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
    } | null;
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
    const params: number[] = [];
    const whereClause = input?.before ? `(created_at < ? or (created_at = ? and id < ?))` : null;
    if (input?.before) {
      params.push(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId);
    }
    const rowsDescending = this.db
      .query(
        `select id, created_at
         from ai_call
         ${whereClause ? `where ${whereClause}` : ""}
         order by created_at desc, id desc
         limit ?`,
      )
      .all(...params, limit + 1) as Array<{ id: number; created_at: number }>;
    const hasMoreBefore = rowsDescending.length > limit;
    const pageDescending = rowsDescending.slice(0, limit);
    const itemsDescending = pageDescending
      .map((row) => this.getAiCallById(row.id))
      .filter((row): row is SessionAiCallRecord => row !== null)
      .reverse();
    const nextCursorSource = hasMoreBefore ? (pageDescending.at(-1) ?? null) : null;
    return {
      items: itemsDescending,
      nextBefore: nextCursorSource
        ? {
            beforeTimeMs: nextCursorSource.created_at,
            beforeId: nextCursorSource.id,
          }
        : null,
      hasMoreBefore,
    };
  }

  pruneAiCallsBeforeRound(minRoundIndex: number): void {
    this.db.query(`delete from ai_call where round_index < ?`).run(minRoundIndex);
  }

  appendAttentionDispatch(input: SessionAttentionDispatchInsert): SessionAttentionDispatchRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    this.db
      .query(
        `insert into attention_dispatch (
           dispatch_id,
           context_id,
           commit_id,
           cycle_id,
           attempt_index,
           agent_call_id,
           session_model_call_id,
           created_at,
           updated_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.dispatchId,
        input.contextId,
        input.commitId,
        input.cycleId,
        input.attemptIndex,
        input.agentCallId,
        input.sessionModelCallId ?? null,
        createdAt,
        updatedAt,
      );
    const record = this.getAttentionDispatchByDispatchId(input.dispatchId);
    if (!record) {
      throw new Error(`failed to load inserted attention_dispatch ${input.dispatchId}`);
    }
    return record;
  }

  getAttentionDispatchByDispatchId(dispatchId: string): SessionAttentionDispatchRecord | null {
    const row = this.db
      .query(
        `select id, dispatch_id, context_id, commit_id, cycle_id, attempt_index, agent_call_id,
                session_model_call_id, created_at, updated_at
         from attention_dispatch
         where dispatch_id = ?`,
      )
      .get(dispatchId) as {
      id: number;
      dispatch_id: string;
      context_id: string;
      commit_id: string;
      cycle_id: number;
      attempt_index: number;
      agent_call_id: string;
      session_model_call_id: number | null;
      created_at: number;
      updated_at: number;
    } | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      dispatchId: row.dispatch_id,
      contextId: row.context_id,
      commitId: row.commit_id,
      cycleId: row.cycle_id,
      attemptIndex: row.attempt_index,
      agentCallId: row.agent_call_id,
      sessionModelCallId: row.session_model_call_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  bindAttentionDispatchModelCall(
    dispatchId: string,
    sessionModelCallId: number,
    updatedAt = Date.now(),
  ): SessionAttentionDispatchRecord {
    const current = this.getAttentionDispatchByDispatchId(dispatchId);
    if (!current) {
      throw new Error(`attention_dispatch not found: ${dispatchId}`);
    }
    this.db.exec("begin immediate");
    try {
      this.db
        .query(
          `update attention_dispatch
           set session_model_call_id = ?, updated_at = ?
           where dispatch_id = ?`,
        )
        .run(sessionModelCallId, updatedAt, dispatchId);
      this.db
        .query(
          `update attention_receipt
           set session_model_call_id = ?
           where dispatch_id = ?`,
        )
        .run(sessionModelCallId, dispatchId);
      this.db.exec("commit");
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
    const record = this.getAttentionDispatchByDispatchId(dispatchId);
    if (!record) {
      throw new Error(`failed to load updated attention_dispatch ${dispatchId}`);
    }
    return record;
  }

  listAttentionDispatches(input?: {
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    agentCallId?: string;
  }): SessionAttentionDispatchRecord[] {
    const rows = this.db
      .query(
        `select dispatch_id
         from attention_dispatch
         where (? is null or context_id = ?)
           and (? is null or commit_id = ?)
           and (? is null or cycle_id = ?)
           and (? is null or session_model_call_id = ?)
           and (? is null or agent_call_id = ?)
         order by created_at asc, attempt_index asc, id asc`,
      )
      .all(
        input?.contextId ?? null,
        input?.contextId ?? null,
        input?.commitId ?? null,
        input?.commitId ?? null,
        input?.cycleId ?? null,
        input?.cycleId ?? null,
        input?.sessionModelCallId ?? null,
        input?.sessionModelCallId ?? null,
        input?.agentCallId ?? null,
        input?.agentCallId ?? null,
      ) as Array<{ dispatch_id: string }>;
    return rows
      .map((row) => this.getAttentionDispatchByDispatchId(row.dispatch_id))
      .filter((row): row is SessionAttentionDispatchRecord => row !== null);
  }

  appendAttentionReceipt(input: SessionAttentionReceiptInsert): SessionAttentionReceiptRecord {
    const timestamp = input.timestamp ?? Date.now();
    this.db
      .query(
        `insert into attention_receipt (
           receipt_id,
           dispatch_id,
           context_id,
           commit_id,
           cycle_id,
           attempt_index,
           agent_call_id,
           session_model_call_id,
           status,
           provider_event_kind,
           timestamp,
           finish_reason,
           usage_json,
           error_code,
           error_message,
           meta_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.receiptId,
        input.dispatchId,
        input.contextId,
        input.commitId,
        input.cycleId,
        input.attemptIndex,
        input.agentCallId,
        input.sessionModelCallId ?? null,
        input.status,
        input.providerEventKind,
        timestamp,
        input.finishReason ?? null,
        input.usage === undefined ? null : toJson(input.usage),
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.meta === undefined ? null : toJson(input.meta),
      );
    const record = this.getAttentionReceiptByReceiptId(input.receiptId);
    if (!record) {
      throw new Error(`failed to load inserted attention_receipt ${input.receiptId}`);
    }
    return record;
  }

  getAttentionReceiptByReceiptId(receiptId: string): SessionAttentionReceiptRecord | null {
    const row = this.db
      .query(
        `select id, receipt_id, dispatch_id, context_id, commit_id, cycle_id, attempt_index, agent_call_id,
                session_model_call_id, status, provider_event_kind, timestamp, finish_reason, usage_json,
                error_code, error_message, meta_json
         from attention_receipt
         where receipt_id = ?`,
      )
      .get(receiptId) as {
      id: number;
      receipt_id: string;
      dispatch_id: string;
      context_id: string;
      commit_id: string;
      cycle_id: number;
      attempt_index: number;
      agent_call_id: string;
      session_model_call_id: number | null;
      status: SessionAttentionReceiptStatus;
      provider_event_kind: SessionAttentionReceiptProviderEventKind;
      timestamp: number;
      finish_reason: string | null;
      usage_json: string | null;
      error_code: string | null;
      error_message: string | null;
      meta_json: string | null;
    } | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      receiptId: row.receipt_id,
      dispatchId: row.dispatch_id,
      contextId: row.context_id,
      commitId: row.commit_id,
      cycleId: row.cycle_id,
      attemptIndex: row.attempt_index,
      agentCallId: row.agent_call_id,
      sessionModelCallId: row.session_model_call_id,
      status: row.status,
      providerEventKind: row.provider_event_kind,
      timestamp: row.timestamp,
      finishReason: row.finish_reason,
      usage: row.usage_json === null ? undefined : parseJson(row.usage_json, undefined),
      errorCode: row.error_code ?? undefined,
      errorMessage: row.error_message ?? undefined,
      meta: row.meta_json === null ? undefined : parseJson(row.meta_json, undefined),
    };
  }

  listAttentionReceipts(input?: {
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    dispatchId?: string;
    agentCallId?: string;
  }): SessionAttentionReceiptRecord[] {
    const rows = this.db
      .query(
        `select receipt_id
         from attention_receipt
         where (? is null or context_id = ?)
           and (? is null or commit_id = ?)
           and (? is null or cycle_id = ?)
           and (? is null or session_model_call_id = ?)
           and (? is null or dispatch_id = ?)
           and (? is null or agent_call_id = ?)
         order by timestamp asc, id asc`,
      )
      .all(
        input?.contextId ?? null,
        input?.contextId ?? null,
        input?.commitId ?? null,
        input?.commitId ?? null,
        input?.cycleId ?? null,
        input?.cycleId ?? null,
        input?.sessionModelCallId ?? null,
        input?.sessionModelCallId ?? null,
        input?.dispatchId ?? null,
        input?.dispatchId ?? null,
        input?.agentCallId ?? null,
        input?.agentCallId ?? null,
      ) as Array<{ receipt_id: string }>;
    return rows
      .map((row) => this.getAttentionReceiptByReceiptId(row.receipt_id))
      .filter((row): row is SessionAttentionReceiptRecord => row !== null);
  }

  appendRuntimeWatch(input: SessionRuntimeWatchInsert): SessionRuntimeWatchRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const status = input.status ?? "pending";
    this.db
      .query(
        `insert into runtime_watch (
           watch_id,
           owner_action_id,
           owner_action_kind,
           owner_actor_id,
           owner_cycle_id,
           owner_session_model_call_id,
           target,
           predicate_json,
           due_at,
           status,
           created_at,
           updated_at,
           resolved_at,
           reminder_context_id,
           reminder_commit_id,
           meta_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.watchId,
        input.ownerActionId,
        input.ownerActionKind,
        input.ownerActorId,
        input.ownerCycleId ?? null,
        input.ownerSessionModelCallId ?? null,
        input.target,
        toJson(input.predicate),
        input.dueAt,
        status,
        createdAt,
        updatedAt,
        input.resolvedAt ?? null,
        input.reminderContextId ?? null,
        input.reminderCommitId ?? null,
        input.meta === undefined ? null : toJson(input.meta),
      );
    const record = this.getRuntimeWatchByWatchId(input.watchId);
    if (!record) {
      throw new Error(`failed to load runtime_watch ${input.watchId}`);
    }
    return record;
  }

  upsertRuntimeWatch(input: SessionRuntimeWatchInsert): SessionRuntimeWatchRecord {
    const current = this.getRuntimeWatchByWatchId(input.watchId);
    if (!current) {
      return this.appendRuntimeWatch(input);
    }
    const updatedAt = input.updatedAt ?? Date.now();
    const status = input.status ?? "pending";
    const resolvedAt = input.resolvedAt !== undefined ? input.resolvedAt : status === "pending" ? null : current.resolvedAt;
    this.db
      .query(
        `update runtime_watch
         set owner_action_id = ?,
             owner_action_kind = ?,
             owner_actor_id = ?,
             owner_cycle_id = ?,
             owner_session_model_call_id = ?,
             target = ?,
             predicate_json = ?,
             due_at = ?,
             status = ?,
             updated_at = ?,
             resolved_at = ?,
             reminder_context_id = ?,
             reminder_commit_id = ?,
             meta_json = ?
         where watch_id = ?`,
      )
      .run(
        input.ownerActionId,
        input.ownerActionKind,
        input.ownerActorId,
        input.ownerCycleId ?? null,
        input.ownerSessionModelCallId ?? null,
        input.target,
        toJson(input.predicate),
        input.dueAt,
        status,
        updatedAt,
        resolvedAt ?? null,
        input.reminderContextId ?? null,
        input.reminderCommitId ?? null,
        input.meta === undefined ? null : toJson(input.meta),
        input.watchId,
      );
    const record = this.getRuntimeWatchByWatchId(input.watchId);
    if (!record) {
      throw new Error(`failed to load upserted runtime_watch ${input.watchId}`);
    }
    return record;
  }

  updateRuntimeWatch(watchId: string, input: SessionRuntimeWatchUpdate): SessionRuntimeWatchRecord {
    const current = this.getRuntimeWatchByWatchId(watchId);
    if (!current) {
      throw new Error(`runtime_watch not found: ${watchId}`);
    }
    const updatedAt = input.updatedAt ?? Date.now();
    const nextStatus = input.status ?? current.status;
    const nextResolvedAt =
      input.resolvedAt !== undefined ? input.resolvedAt : nextStatus === "pending" ? null : current.resolvedAt ?? updatedAt;
    const nextReminderContextId =
      input.reminderContextId !== undefined ? input.reminderContextId : current.reminderContextId ?? null;
    const nextReminderCommitId =
      input.reminderCommitId !== undefined ? input.reminderCommitId : current.reminderCommitId ?? null;
    const nextMeta = input.meta !== undefined ? input.meta : current.meta;
    this.db
      .query(
        `update runtime_watch
         set status = ?,
             updated_at = ?,
             resolved_at = ?,
             reminder_context_id = ?,
             reminder_commit_id = ?,
             meta_json = ?
         where watch_id = ?`,
      )
      .run(
        nextStatus,
        updatedAt,
        nextResolvedAt,
        nextReminderContextId,
        nextReminderCommitId,
        nextMeta === undefined ? null : toJson(nextMeta),
        watchId,
      );
    const record = this.getRuntimeWatchByWatchId(watchId);
    if (!record) {
      throw new Error(`failed to load updated runtime_watch ${watchId}`);
    }
    return record;
  }

  getRuntimeWatchByWatchId(watchId: string): SessionRuntimeWatchRecord | null {
    const row = this.db
      .query(
        `select id, watch_id, owner_action_id, owner_action_kind, owner_actor_id, owner_cycle_id,
                owner_session_model_call_id, target, predicate_json, due_at, status, created_at,
                updated_at, resolved_at, reminder_context_id, reminder_commit_id, meta_json
         from runtime_watch
         where watch_id = ?`,
      )
      .get(watchId) as {
      id: number;
      watch_id: string;
      owner_action_id: string;
      owner_action_kind: string;
      owner_actor_id: string;
      owner_cycle_id: number | null;
      owner_session_model_call_id: number | null;
      target: string;
      predicate_json: string;
      due_at: number;
      status: SessionRuntimeWatchStatus;
      created_at: number;
      updated_at: number;
      resolved_at: number | null;
      reminder_context_id: string | null;
      reminder_commit_id: string | null;
      meta_json: string | null;
    } | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      watchId: row.watch_id,
      ownerActionId: row.owner_action_id,
      ownerActionKind: row.owner_action_kind,
      ownerActorId: row.owner_actor_id,
      ownerCycleId: row.owner_cycle_id,
      ownerSessionModelCallId: row.owner_session_model_call_id,
      target: row.target,
      predicate: parseJson<SessionRuntimeWatchRecord["predicate"]>(row.predicate_json, {
        kind: "message_latest_visible",
        chatId: "",
        anchorMessageId: 0,
      }),
      dueAt: row.due_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      reminderContextId: row.reminder_context_id,
      reminderCommitId: row.reminder_commit_id,
      meta: row.meta_json === null ? undefined : parseJson(row.meta_json, undefined),
    };
  }

  listRuntimeWatches(input?: {
    status?: SessionRuntimeWatchStatus;
    ownerActionId?: string;
    target?: string;
  }): SessionRuntimeWatchRecord[] {
    const rows = this.db
      .query(
        `select watch_id
         from runtime_watch
         where (? is null or status = ?)
           and (? is null or owner_action_id = ?)
           and (? is null or target = ?)
         order by due_at asc, created_at asc, id asc`,
      )
      .all(
        input?.status ?? null,
        input?.status ?? null,
        input?.ownerActionId ?? null,
        input?.ownerActionId ?? null,
        input?.target ?? null,
        input?.target ?? null,
      ) as Array<{ watch_id: string }>;
    return rows
      .map((row) => this.getRuntimeWatchByWatchId(row.watch_id))
      .filter((row): row is SessionRuntimeWatchRecord => row !== null);
  }

  appendEffectLedger(input: SessionEffectLedgerInsert): SessionEffectLedgerRecord {
    const timestamp = input.timestamp ?? Date.now();
    this.db
      .query(
        `insert into effect_ledger (
           effect_id,
           action_id,
           action_kind,
           actor_id,
           cycle_id,
           session_model_call_id,
           target,
           effect_kind,
           effect_record_id,
           timestamp,
           meta_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.effectId,
        input.actionId,
        input.actionKind,
        input.actorId,
        input.cycleId ?? null,
        input.sessionModelCallId ?? null,
        input.target,
        input.effectKind,
        input.effectRecordId,
        timestamp,
        input.meta === undefined ? null : toJson(input.meta),
      );
    const record = this.getEffectLedgerByEffectId(input.effectId);
    if (!record) {
      throw new Error(`failed to load effect_ledger ${input.effectId}`);
    }
    return record;
  }

  getEffectLedgerByEffectId(effectId: string): SessionEffectLedgerRecord | null {
    const row = this.db
      .query(
        `select id, effect_id, action_id, action_kind, actor_id, cycle_id, session_model_call_id, target,
                effect_kind, effect_record_id, timestamp, meta_json
         from effect_ledger
         where effect_id = ?`,
      )
      .get(effectId) as {
      id: number;
      effect_id: string;
      action_id: string;
      action_kind: string;
      actor_id: string;
      cycle_id: number | null;
      session_model_call_id: number | null;
      target: string;
      effect_kind: string;
      effect_record_id: string;
      timestamp: number;
      meta_json: string | null;
    } | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      effectId: row.effect_id,
      actionId: row.action_id,
      actionKind: row.action_kind,
      actorId: row.actor_id,
      cycleId: row.cycle_id,
      sessionModelCallId: row.session_model_call_id,
      target: row.target,
      effectKind: row.effect_kind,
      effectRecordId: row.effect_record_id,
      timestamp: row.timestamp,
      meta: row.meta_json === null ? undefined : parseJson(row.meta_json, undefined),
    };
  }

  listEffectLedger(input?: {
    actionId?: string;
    actorId?: string;
    target?: string;
    effectKind?: string;
    cycleId?: number;
    sessionModelCallId?: number;
  }): SessionEffectLedgerRecord[] {
    const rows = this.db
      .query(
        `select effect_id
         from effect_ledger
         where (? is null or action_id = ?)
           and (? is null or actor_id = ?)
           and (? is null or target = ?)
           and (? is null or effect_kind = ?)
           and (? is null or cycle_id = ?)
           and (? is null or session_model_call_id = ?)
         order by timestamp asc, id asc`,
      )
      .all(
        input?.actionId ?? null,
        input?.actionId ?? null,
        input?.actorId ?? null,
        input?.actorId ?? null,
        input?.target ?? null,
        input?.target ?? null,
        input?.effectKind ?? null,
        input?.effectKind ?? null,
        input?.cycleId ?? null,
        input?.cycleId ?? null,
        input?.sessionModelCallId ?? null,
        input?.sessionModelCallId ?? null,
      ) as Array<{ effect_id: string }>;
    return rows
      .map((row) => this.getEffectLedgerByEffectId(row.effect_id))
      .filter((row): row is SessionEffectLedgerRecord => row !== null);
  }

  appendNotifyQuotaRecord(input: SessionNotifyQuotaInsert): SessionNotifyQuotaRecord {
    const sentAt = input.sentAt ?? Date.now();
    const windowKind = input.windowKind ?? "period";
    this.db
      .query(
        `insert into notify_quota (
           notify_id,
           context_id,
           quota_target,
           focus_state,
           source_id,
           commit_id,
           sent_at,
           window_kind,
           window_ms,
           meta_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.notifyId,
        input.contextId,
        input.quotaTarget,
        input.focusState,
        input.sourceId,
        input.commitId,
        sentAt,
        windowKind,
        input.windowMs,
        input.meta === undefined ? null : toJson(input.meta),
      );
    const record = this.getNotifyQuotaRecordByNotifyId(input.notifyId);
    if (!record) {
      throw new Error(`failed to load notify_quota ${input.notifyId}`);
    }
    return record;
  }

  getNotifyQuotaRecordByNotifyId(notifyId: string): SessionNotifyQuotaRecord | null {
    const row = this.db
      .query(
        `select id, notify_id, context_id, quota_target, focus_state, source_id, commit_id, sent_at, window_kind, window_ms, meta_json
         from notify_quota
         where notify_id = ?`,
      )
      .get(notifyId) as {
      id: number;
      notify_id: string;
      context_id: string;
      quota_target: string;
      focus_state: SessionNotifyQuotaRecord["focusState"];
      source_id: string;
      commit_id: string;
      sent_at: number;
      window_kind: SessionNotifyQuotaRecord["windowKind"];
      window_ms: number;
      meta_json: string | null;
    } | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      notifyId: row.notify_id,
      contextId: row.context_id,
      quotaTarget: row.quota_target,
      focusState: row.focus_state,
      sourceId: row.source_id,
      commitId: row.commit_id,
      sentAt: row.sent_at,
      windowKind: row.window_kind,
      windowMs: row.window_ms,
      meta: row.meta_json === null ? undefined : parseJson(row.meta_json, undefined),
    };
  }

  listNotifyQuotaRecords(input?: {
    quotaTarget?: string;
    contextId?: string;
    focusState?: SessionNotifyQuotaRecord["focusState"];
    sourceId?: string;
    sentAfter?: number;
  }): SessionNotifyQuotaRecord[] {
    const rows = this.db
      .query(
        `select notify_id
         from notify_quota
         where (? is null or quota_target = ?)
           and (? is null or context_id = ?)
           and (? is null or focus_state = ?)
           and (? is null or source_id = ?)
           and (? is null or sent_at >= ?)
         order by sent_at desc, id desc`,
      )
      .all(
        input?.quotaTarget ?? null,
        input?.quotaTarget ?? null,
        input?.contextId ?? null,
        input?.contextId ?? null,
        input?.focusState ?? null,
        input?.focusState ?? null,
        input?.sourceId ?? null,
        input?.sourceId ?? null,
        input?.sentAfter ?? null,
        input?.sentAfter ?? null,
      ) as Array<{ notify_id: string }>;
    return rows
      .map((row) => this.getNotifyQuotaRecordByNotifyId(row.notify_id))
      .filter((row): row is SessionNotifyQuotaRecord => row !== null);
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
      .get(id) as {
      id: string;
      kind: SessionAssetRecord["kind"];
      created_at: number;
      name: string;
      mime_type: string;
      size_bytes: number;
      relative_path: string;
    } | null;
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

  private queryMessageHeadRowsByScopes(
    scopes: readonly SessionMessageScope[],
    input?: {
      windowId?: string;
      aiCallIds?: readonly number[];
      onlyNullAiCall?: boolean;
      before?: ReverseTimeCursor;
      afterCreatedAt?: number;
      afterInclusive?: boolean;
      beforeCreatedAt?: number;
      beforeInclusive?: boolean;
      limit?: number;
      order?: "asc" | "desc";
    },
  ): StoredMessageHeadRow[] {
    if (scopes.length === 0) {
      return [];
    }
    const scopePlaceholders = scopes.map(() => "?").join(", ");
    const whereClauses = [`scope in (${scopePlaceholders})`, `part_index = 0`];
    const params: Array<number | string> = [...scopes];
    if (input?.windowId) {
      whereClauses.push(`window_id = ?`);
      params.push(input.windowId);
    }
    if (input?.aiCallIds && input.aiCallIds.length > 0) {
      const aiCallPlaceholders = input.aiCallIds.map(() => "?").join(", ");
      whereClauses.push(`ai_call_id in (${aiCallPlaceholders})`);
      params.push(...input.aiCallIds);
    } else if (input?.onlyNullAiCall) {
      whereClauses.push(`ai_call_id is null`);
    }
    if (input?.afterCreatedAt !== undefined) {
      whereClauses.push(`created_at ${input.afterInclusive ? ">=" : ">"} ?`);
      params.push(input.afterCreatedAt);
    }
    if (input?.beforeCreatedAt !== undefined) {
      whereClauses.push(`created_at ${input.beforeInclusive ? "<=" : "<"} ?`);
      params.push(input.beforeCreatedAt);
    }
    if (input?.before) {
      whereClauses.push(`(created_at < ? or (created_at = ? and part_id < ?))`);
      params.push(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId);
    }
    const direction = input?.order === "asc" ? "asc" : "desc";
    const sql = [
      `select part_id as id,`,
      `       message_id,`,
      `       window_id,`,
      `       ai_call_id,`,
      `       round_index,`,
      `       scope,`,
      `       role,`,
      `       created_at,`,
      `       updated_at`,
      `from message_part`,
      `where ${whereClauses.join(" and ")}`,
      `order by created_at ${direction}, part_id ${direction}`,
      input?.limit ? "limit ?" : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (input?.limit) {
      params.push(resolvePageLimit(input.limit));
    }
    return this.db.query(sql).all(...params) as StoredMessageHeadRow[];
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
    if (currentVersion < 1) {
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
    }
    if (currentVersion < 2) {
      this.db.exec(`
        create table if not exists attention_dispatch (
          id integer primary key autoincrement,
          dispatch_id text not null unique,
          context_id text not null,
          commit_id text not null,
          cycle_id integer not null,
          attempt_index integer not null,
          agent_call_id text not null,
          session_model_call_id integer,
          created_at integer not null,
          updated_at integer not null
        );
        create index if not exists idx_attention_dispatch_context_commit
          on attention_dispatch(context_id, commit_id, created_at asc, id asc);
        create index if not exists idx_attention_dispatch_cycle
          on attention_dispatch(cycle_id, created_at asc, id asc);
        create index if not exists idx_attention_dispatch_model_call
          on attention_dispatch(session_model_call_id, created_at asc, id asc);
        create index if not exists idx_attention_dispatch_agent_call
          on attention_dispatch(agent_call_id, created_at asc, id asc);

        create table if not exists attention_receipt (
          id integer primary key autoincrement,
          receipt_id text not null unique,
          dispatch_id text not null,
          context_id text not null,
          commit_id text not null,
          cycle_id integer not null,
          attempt_index integer not null,
          agent_call_id text not null,
          session_model_call_id integer,
          status text not null,
          provider_event_kind text not null,
          timestamp integer not null,
          finish_reason text,
          usage_json text,
          error_code text,
          error_message text,
          meta_json text
        );
        create index if not exists idx_attention_receipt_dispatch
          on attention_receipt(dispatch_id, timestamp asc, id asc);
        create index if not exists idx_attention_receipt_context_commit
          on attention_receipt(context_id, commit_id, timestamp asc, id asc);
        create index if not exists idx_attention_receipt_cycle
          on attention_receipt(cycle_id, timestamp asc, id asc);
        create index if not exists idx_attention_receipt_model_call
          on attention_receipt(session_model_call_id, timestamp asc, id asc);
      `);
    }
    if (currentVersion < 3) {
      this.db.exec(`
        create table if not exists runtime_watch (
          id integer primary key autoincrement,
          watch_id text not null unique,
          owner_action_id text not null,
          owner_action_kind text not null,
          owner_actor_id text not null,
          owner_cycle_id integer,
          owner_session_model_call_id integer,
          target text not null,
          predicate_json text not null,
          due_at integer not null,
          status text not null,
          created_at integer not null,
          updated_at integer not null,
          resolved_at integer,
          reminder_context_id text,
          reminder_commit_id text,
          meta_json text
        );
        create index if not exists idx_runtime_watch_due_status
          on runtime_watch(status, due_at asc, id asc);
        create index if not exists idx_runtime_watch_owner_action
          on runtime_watch(owner_action_id, created_at asc, id asc);
        create index if not exists idx_runtime_watch_target
          on runtime_watch(target, created_at asc, id asc);

        create table if not exists effect_ledger (
          id integer primary key autoincrement,
          effect_id text not null unique,
          action_id text not null,
          action_kind text not null,
          actor_id text not null,
          cycle_id integer,
          session_model_call_id integer,
          target text not null,
          effect_kind text not null,
          effect_record_id text not null,
          timestamp integer not null,
          meta_json text
        );
        create index if not exists idx_effect_ledger_action
          on effect_ledger(action_id, timestamp asc, id asc);
        create index if not exists idx_effect_ledger_target
          on effect_ledger(target, timestamp asc, id asc);
        create index if not exists idx_effect_ledger_cycle
          on effect_ledger(cycle_id, timestamp asc, id asc);
        create index if not exists idx_effect_ledger_model_call
          on effect_ledger(session_model_call_id, timestamp asc, id asc);
      `);
    }
    if (currentVersion < 4) {
      this.db.exec(`
        create table if not exists notify_quota (
          id integer primary key autoincrement,
          notify_id text not null unique,
          context_id text not null,
          quota_target text not null,
          focus_state text not null,
          source_id text not null,
          commit_id text not null,
          sent_at integer not null,
          window_kind text not null,
          window_ms integer not null,
          meta_json text
        );
        create index if not exists idx_notify_quota_target_sent
          on notify_quota(quota_target, sent_at desc, id desc);
        create index if not exists idx_notify_quota_context_sent
          on notify_quota(context_id, sent_at desc, id desc);
        create index if not exists idx_notify_quota_focus_sent
          on notify_quota(focus_state, sent_at desc, id desc);
      `);
    }
    this.db.exec(`pragma user_version = ${SESSION_DB_SCHEMA_VERSION}`);
  }
}
