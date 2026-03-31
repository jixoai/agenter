import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import type {
  ApiCallInsert,
  ApiCallRecord,
  LoopbusStateLogInsert,
  LoopbusStateLogRecord,
  LoopbusTraceInsert,
  LoopbusTraceRecord,
  LoopbusTraceUpdate,
  ReversePage,
  ReverseTimeCursor,
  SessionAssetInsert,
  SessionAssetRecord,
  SessionBlockAssetRecord,
  SessionBlockInsert,
  SessionBlockRecord,
  SessionCycleInsert,
  SessionCycleRecord,
  SessionCycleUpdate,
  SessionHeadRecord,
  SessionModelCallInsert,
  SessionModelCallRecord,
  SessionModelCallUpdate,
  TerminalActivityInsert,
  TerminalActivityRecord,
} from "./types";
import { decodeLoopTraceRow, encodeLoopTraceRow, mergeLoopTraceRecord, type StoredLoopTraceRow } from "./trace-row";

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

const buildNextCursor = <T extends { createdAt: number; id: number }>(
  itemsDescending: T[],
  hasMoreBefore: boolean,
): ReverseTimeCursor | null => {
  if (!hasMoreBefore || itemsDescending.length === 0) {
    return null;
  }
  const oldest = itemsDescending.at(-1);
  if (!oldest) {
    return null;
  }
  return {
    beforeTimeMs: oldest.createdAt,
    beforeId: oldest.id,
  };
};

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
      .query(`select head_cycle_id, updated_at from session_head where id = 1`)
      .get() as { head_cycle_id: number | null; updated_at: number } | null;
    return {
      headCycleId: row?.head_cycle_id ?? null,
      updatedAt: row?.updated_at ?? Date.now(),
    };
  }

  setHead(headCycleId: number | null, updatedAt = Date.now()): SessionHeadRecord {
    this.db
      .query(`update session_head set head_cycle_id = ?, updated_at = ? where id = 1`)
      .run(headCycleId, updatedAt);
    return { headCycleId, updatedAt };
  }

  appendCycle(input: SessionCycleInsert): SessionCycleRecord {
    const createdAt = input.createdAt ?? Date.now();
    const seq = this.nextSeq('session_cycle');
    const result = this.db
      .query(
        `insert into session_cycle (
          seq,
          prev_cycle_id,
          created_at,
          wake_json,
          collected_inputs_json,
          extends_json,
          result_json
        ) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        seq,
        input.prevCycleId ?? null,
        createdAt,
        toJson(input.wake ?? {}),
        toJson(input.collectedInputs ?? []),
        toJson(input.extendsRecord ?? {}),
        toJson(input.result ?? {}),
      );
    const record = this.getCycleById(Number(result.lastInsertRowid));
    if (!record) {
      throw new Error('failed to load inserted cycle');
    }
    return record;
  }

  getCycleById(id: number): SessionCycleRecord | null {
    const row = this.db
      .query(
        `select id, seq, prev_cycle_id, created_at, wake_json, collected_inputs_json, extends_json, result_json
         from session_cycle
         where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          seq: number;
          prev_cycle_id: number | null;
          created_at: number;
          wake_json: string;
          collected_inputs_json: string;
          extends_json: string;
          result_json: string;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      seq: row.seq,
      prevCycleId: row.prev_cycle_id,
      createdAt: row.created_at,
      wake: parseJson(row.wake_json, {}),
      collectedInputs: parseJson(row.collected_inputs_json, []),
      extendsRecord: parseJson(row.extends_json, {}),
      result: parseJson(row.result_json, {}),
    };
  }

  updateCycle(id: number, input: SessionCycleUpdate): SessionCycleRecord {
    const current = this.getCycleById(id);
    if (!current) {
      throw new Error(`cycle not found: ${id}`);
    }
    this.db
      .query(
        `update session_cycle
         set wake_json = ?,
             collected_inputs_json = ?,
             extends_json = ?,
             result_json = ?
         where id = ?`,
      )
      .run(
        toJson(input.wake ?? current.wake),
        toJson(input.collectedInputs ?? current.collectedInputs),
        toJson(input.extendsRecord ?? current.extendsRecord),
        toJson(input.result ?? current.result),
        id,
      );
    const record = this.getCycleById(id);
    if (!record) {
      throw new Error("failed to load updated cycle");
    }
    return record;
  }

  listCycles(limit = 200): SessionCycleRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(
        `select id, seq, prev_cycle_id, created_at, wake_json, collected_inputs_json, extends_json, result_json
         from session_cycle
         order by seq desc
         limit ?`,
      )
      .all(safeLimit) as Array<{
      id: number;
      seq: number;
      prev_cycle_id: number | null;
      created_at: number;
      wake_json: string;
      collected_inputs_json: string;
      extends_json: string;
      result_json: string;
    }>;

    return rows.reverse().map((row) => ({
      id: row.id,
      seq: row.seq,
      prevCycleId: row.prev_cycle_id,
      createdAt: row.created_at,
      wake: parseJson(row.wake_json, {}),
      collectedInputs: parseJson(row.collected_inputs_json, []),
      extendsRecord: parseJson(row.extends_json, {}),
      result: parseJson(row.result_json, {}),
    }));
  }

  listCurrentBranchCycles(limit = 200): SessionCycleRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const head = this.getHead().headCycleId;
    if (head === null) {
      return [];
    }
    const items: SessionCycleRecord[] = [];
    let cursor: number | null = head;
    while (cursor !== null && items.length < safeLimit) {
      const row = this.getCycleById(cursor);
      if (!row) {
        break;
      }
      items.push(row);
      cursor = row.prevCycleId;
    }
    return items.reverse();
  }

  listCurrentBranchCyclesBefore(beforeId: number, limit = 200): SessionCycleRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const before = this.getCycleById(beforeId);
    if (!before) {
      return [];
    }
    const items: SessionCycleRecord[] = [];
    let cursor: number | null = before.prevCycleId;
    while (cursor !== null && items.length < safeLimit) {
      const row = this.getCycleById(cursor);
      if (!row) {
        break;
      }
      items.push(row);
      cursor = row.prevCycleId;
    }
    return items.reverse();
  }

  listCurrentBranchCyclesPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<SessionCycleRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const head = this.getHead().headCycleId;
    if (head === null) {
      return {
        items: [],
        nextBefore: null,
        hasMoreBefore: false,
      };
    }

    const itemsDescending: SessionCycleRecord[] = [];
    let cursor: number | null = head;
    while (cursor !== null) {
      const row = this.getCycleById(cursor);
      if (!row) {
        break;
      }
      cursor = row.prevCycleId;
      if (!isBeforeCursor({ createdAt: row.createdAt, id: row.id }, input?.before)) {
        continue;
      }
      itemsDescending.push(row);
      if (itemsDescending.length > safeLimit) {
        break;
      }
    }

    const hasMoreBefore = itemsDescending.length > safeLimit;
    const visibleDescending = hasMoreBefore ? itemsDescending.slice(0, safeLimit) : itemsDescending;
    return {
      items: visibleDescending.slice().reverse(),
      nextBefore: buildNextCursor(visibleDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  appendModelCall(input: SessionModelCallInsert): SessionModelCallRecord {
    const createdAt = input.createdAt ?? Date.now();
    const status = input.status ?? (input.error ? "error" : input.response === undefined ? "running" : "done");
    const result = this.db
      .query(
        `insert into model_call (
          cycle_id,
          created_at,
          status,
          completed_at,
          provider,
          model,
          request_json,
          response_json,
          error_json,
          trace_json,
          outcome_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.cycleId,
        createdAt,
        status,
        input.completedAt ?? null,
        input.provider,
        input.model,
        toJson(input.request),
        input.response === undefined ? null : toJson(input.response),
        input.error === undefined ? null : toJson(input.error),
        input.trace === undefined ? null : toJson(input.trace),
        input.outcome === undefined ? null : toJson(input.outcome),
      );
    const row = this.getModelCallById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error('failed to load inserted model_call');
    }
    return row;
  }

  getModelCallById(id: number): SessionModelCallRecord | null {
    const row = this.db
      .query(
        `select id, cycle_id, created_at, status, completed_at, provider, model, request_json, response_json, error_json, trace_json, outcome_json
         from model_call where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          cycle_id: number;
          created_at: number;
          status: SessionModelCallRecord["status"];
          completed_at: number | null;
          provider: string;
          model: string;
          request_json: string;
          response_json: string | null;
          error_json: string | null;
          trace_json: string | null;
          outcome_json: string | null;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      cycleId: row.cycle_id,
      createdAt: row.created_at,
      status: row.status,
      completedAt: row.completed_at ?? undefined,
      provider: row.provider,
      model: row.model,
      request: parseJson(row.request_json, null),
      response: row.response_json ? parseJson(row.response_json, null) : undefined,
      error: row.error_json ? parseJson(row.error_json, null) : undefined,
      trace: row.trace_json ? parseJson(row.trace_json, null) ?? undefined : undefined,
      outcome: row.outcome_json ? parseJson(row.outcome_json, null) ?? undefined : undefined,
    };
  }

  updateModelCall(id: number, input: SessionModelCallUpdate): SessionModelCallRecord {
    this.db
      .query(
        `update model_call
         set status = coalesce(?, status),
             completed_at = ?,
             response_json = ?,
             error_json = ?,
             trace_json = ?,
             outcome_json = ?
         where id = ?`,
      )
      .run(
        input.status ?? null,
        input.completedAt ?? null,
        input.response === undefined ? null : toJson(input.response),
        input.error === undefined ? null : toJson(input.error),
        input.trace === undefined ? null : toJson(input.trace),
        input.outcome === undefined ? null : toJson(input.outcome),
        id,
      );
    const row = this.getModelCallById(id);
    if (!row) {
      throw new Error("failed to load updated model_call");
    }
    return row;
  }

  getModelCallByCycleId(cycleId: number): SessionModelCallRecord | null {
    const row = this.db
      .query(`select id from model_call where cycle_id = ? order by id desc limit 1`)
      .get(cycleId) as { id: number } | null;
    return row ? this.getModelCallById(row.id) : null;
  }

  listModelCalls(limit = 200): SessionModelCallRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from model_call order by id desc limit ?`)
      .all(safeLimit) as Array<{ id: number }>;
    return rows.reverse().map((row) => this.getModelCallById(row.id)).filter((row): row is SessionModelCallRecord => row !== null);
  }

  listModelCallsAfter(afterId = 0, limit = 200): SessionModelCallRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from model_call where id > ? order by id asc limit ?`)
      .all(afterId, safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getModelCallById(row.id)).filter((row): row is SessionModelCallRecord => row !== null);
  }

  listModelCallsBefore(beforeId: number, limit = 200): SessionModelCallRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from model_call where id < ? order by id desc limit ?`)
      .all(beforeId, safeLimit) as Array<{ id: number }>;
    rows.reverse();
    return rows.map((row) => this.getModelCallById(row.id)).filter((row): row is SessionModelCallRecord => row !== null);
  }

  listModelCallsPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<SessionModelCallRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from model_call
             where created_at < ? or (created_at = ? and id < ?)
             order by created_at desc, id desc
             limit ?`,
          )
          .all(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId, safeLimit + 1) as Array<{
          id: number;
        }>)
      : (this.db
          .query(
            `select id
             from model_call
             order by created_at desc, id desc
             limit ?`,
          )
          .all(safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getModelCallById(row.id))
      .filter((row): row is SessionModelCallRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(recordsDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  appendAsset(input: SessionAssetInsert): SessionAssetRecord {
    const createdAt = input.createdAt ?? Date.now();
    this.db
      .query(
        `insert into session_asset (
          id,
          kind,
          created_at,
          name,
          mime_type,
          size_bytes,
          relative_path
        ) values (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.id, input.kind, createdAt, input.name, input.mimeType, input.sizeBytes, input.relativePath);
    const row = this.getAssetById(input.id);
    if (!row) {
      throw new Error('failed to load inserted session_asset');
    }
    return row;
  }

  getAssetById(id: string): SessionAssetRecord | null {
    const row = this.db
      .query(
        `select id, kind, created_at, name, mime_type, size_bytes, relative_path
         from session_asset where id = ?`
      )
      .get(id) as
      | {
          id: string;
          kind: SessionAssetRecord['kind'];
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
    const result: SessionAssetRecord[] = [];
    for (const id of ids) {
      const row = this.getAssetById(id);
      if (row) {
        result.push(row);
      }
    }
    return result;
  }

  listAssetsByBlockId(blockId: number): SessionAssetRecord[] {
    const rows = this.db
      .query(`select asset_id from session_block_asset where block_id = ? order by seq asc`)
      .all(blockId) as Array<{ asset_id: string }>;
    return rows
      .map((row) => this.getAssetById(row.asset_id))
      .filter((row): row is SessionAssetRecord => row !== null);
  }

  linkBlockAssets(blockId: number, assetIds: string[]): SessionBlockAssetRecord[] {
    const rows: SessionBlockAssetRecord[] = [];
    for (const assetId of assetIds) {
      const seq = this.nextBlockAssetSeq(blockId);
      this.db
        .query(`insert into session_block_asset (block_id, asset_id, seq) values (?, ?, ?)`)
        .run(blockId, assetId, seq);
      rows.push({ blockId, assetId, seq });
    }
    return rows;
  }

  replaceBlockAssets(blockId: number, assetIds: string[]): SessionBlockAssetRecord[] {
    this.db.query(`delete from session_block_asset where block_id = ?`).run(blockId);
    return this.linkBlockAssets(blockId, assetIds);
  }

  appendBlock(input: SessionBlockInsert): SessionBlockRecord {
    const createdAt = input.createdAt ?? Date.now();
    const updatedAt = input.updatedAt ?? createdAt;
    const seq = this.nextSeq('session_block');
    const result = this.db
      .query(
        `insert into session_block (
          seq,
          cycle_id,
          created_at,
          updated_at,
          message_id,
          projection_json,
          visible_at,
          attention_state,
          attention_loaded_at,
          role,
          channel,
          chat_id,
          format,
          content,
          tool_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        seq,
        input.cycleId ?? null,
        createdAt,
        updatedAt,
        input.messageId ?? null,
        input.projection === undefined ? null : toJson(input.projection),
        input.visibleAt ?? null,
        input.attentionState ?? null,
        input.attentionLoadedAt ?? null,
        input.role,
        input.channel,
        input.chatId ?? null,
        input.format ?? 'markdown',
        input.content,
        input.tool === undefined ? null : toJson(input.tool),
      );
    const row = this.getBlockById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error('failed to load inserted session_block');
    }
    return row;
  }

  upsertMessageBlock(input: SessionBlockInsert & { messageId: string }): SessionBlockRecord {
    const current = this.getBlockByMessageId(input.messageId);
    if (!current) {
      return this.appendBlock(input);
    }
    this.db
      .query(
        `update session_block
         set cycle_id = ?,
             created_at = ?,
             updated_at = ?,
             visible_at = ?,
             attention_state = ?,
             attention_loaded_at = ?,
             role = ?,
             channel = ?,
             chat_id = ?,
             format = ?,
             content = ?,
             tool_json = ?,
             projection_json = ?
         where id = ?`,
      )
      .run(
        input.cycleId ?? current.cycleId,
        input.createdAt ?? current.createdAt,
        input.updatedAt ?? current.updatedAt,
        input.visibleAt ?? current.visibleAt ?? null,
        input.attentionState ?? current.attentionState ?? null,
        input.attentionLoadedAt ?? current.attentionLoadedAt ?? null,
        input.role,
        input.channel,
        input.chatId ?? current.chatId,
        input.format ?? current.format,
        input.content,
        input.tool === undefined ? null : toJson(input.tool),
        input.projection === undefined ? (current.projection === undefined ? null : toJson(current.projection)) : toJson(input.projection),
        current.id,
      );
    const row = this.getBlockById(current.id);
    if (!row) {
      throw new Error("failed to load updated session_block");
    }
    return row;
  }

  getBlockByMessageId(messageId: string): SessionBlockRecord | null {
    const row = this.db
      .query(`select id from session_block where message_id = ?`)
      .get(messageId) as { id: number } | null;
    return row ? this.getBlockById(row.id) : null;
  }

  getBlockById(id: number): SessionBlockRecord | null {
    const row = this.db
      .query(
        `select id, seq, cycle_id, created_at, updated_at, message_id, projection_json, visible_at, attention_state, attention_loaded_at, role, channel, chat_id, format, content, tool_json
         from session_block where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          seq: number;
          cycle_id: number | null;
          created_at: number;
          updated_at: number;
          message_id: string | null;
          projection_json: string | null;
          visible_at: number | null;
          attention_state: 'queued' | 'loaded' | null;
          attention_loaded_at: number | null;
          role: 'user' | 'assistant';
          channel: SessionBlockRecord['channel'];
          chat_id: string | null;
          format: SessionBlockRecord['format'];
          content: string;
          tool_json: string | null;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      seq: row.seq,
      cycleId: row.cycle_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageId: row.message_id ?? undefined,
      projection: row.projection_json ? parseJson(row.projection_json, undefined) : undefined,
      visibleAt: row.visible_at ?? undefined,
      attentionState: row.attention_state ?? undefined,
      attentionLoadedAt: row.attention_loaded_at ?? undefined,
      role: row.role,
      channel: row.channel,
      chatId: row.chat_id,
      format: row.format,
      content: row.content,
      tool: row.tool_json ? parseJson(row.tool_json, undefined) : undefined,
      attachments: this.listAssetsByBlockId(row.id),
    };
  }

  listBlocksAfter(afterId = 0, limit = 200): SessionBlockRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from session_block where id > ? order by id asc limit ?`)
      .all(afterId, safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getBlockById(row.id)).filter((row): row is SessionBlockRecord => row !== null);
  }

  listBlocksByCycleId(cycleId: number): SessionBlockRecord[] {
    const rows = this.db
      .query(`select id from session_block where cycle_id = ? order by id asc`)
      .all(cycleId) as Array<{ id: number }>;
    return rows.map((row) => this.getBlockById(row.id)).filter((row): row is SessionBlockRecord => row !== null);
  }

  listOrphanUserInputBlocks(limit = 200): SessionBlockRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 10_000));
    const rows = this.db
      .query(
        `select id
         from session_block
         where cycle_id is null and role = 'user' and channel = 'user_input'
         order by id asc
         limit ?`,
      )
      .all(safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getBlockById(row.id)).filter((row): row is SessionBlockRecord => row !== null);
  }

  listBlocksBefore(beforeId: number, limit = 200): SessionBlockRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from session_block where id < ? order by id desc limit ?`)
      .all(beforeId, safeLimit) as Array<{ id: number }>;
    rows.reverse();
    return rows.map((row) => this.getBlockById(row.id)).filter((row): row is SessionBlockRecord => row !== null);
  }

  listBlocksPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<SessionBlockRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from session_block
             where created_at < ? or (created_at = ? and id < ?)
             order by created_at desc, id desc
             limit ?`,
          )
          .all(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId, safeLimit + 1) as Array<{
          id: number;
        }>)
      : (this.db
          .query(
            `select id
             from session_block
             order by created_at desc, id desc
             limit ?`,
          )
          .all(safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getBlockById(row.id))
      .filter((row): row is SessionBlockRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(recordsDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  appendLoopStateLog(input: LoopbusStateLogInsert): LoopbusStateLogRecord {
    const result = this.db
      .query(
        `insert into loopbus_state_log (
          timestamp,
          state_version,
          event,
          prev_hash,
          state_hash,
          patch_json
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.timestamp, input.stateVersion, input.event, input.prevHash, input.stateHash, toJson(input.patch));
    const row = this.getLoopStateLogById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error("failed to load inserted loopbus_state_log");
    }
    return row;
  }

  getLoopStateLogById(id: number): LoopbusStateLogRecord | null {
    const row = this.db
      .query(
        `select id, timestamp, state_version, event, prev_hash, state_hash, patch_json
         from loopbus_state_log where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          timestamp: number;
          state_version: number;
          event: string;
          prev_hash: string | null;
          state_hash: string;
          patch_json: string;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      timestamp: row.timestamp,
      stateVersion: row.state_version,
      event: row.event,
      prevHash: row.prev_hash,
      stateHash: row.state_hash,
      patch: parseJson(row.patch_json, []),
    };
  }

  listLoopStateLogsPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<LoopbusStateLogRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from loopbus_state_log
             where timestamp < ? or (timestamp = ? and id < ?)
             order by timestamp desc, id desc
             limit ?`,
          )
          .all(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId, safeLimit + 1) as Array<{
          id: number;
        }>)
      : (this.db
          .query(
            `select id
             from loopbus_state_log
             order by timestamp desc, id desc
             limit ?`,
          )
          .all(safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getLoopStateLogById(row.id))
      .filter((row): row is LoopbusStateLogRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(
        recordsDescending.map((record) => ({
          ...record,
          createdAt: record.timestamp,
        })),
        hasMoreBefore,
      ),
      hasMoreBefore,
    };
  }

  appendLoopTrace(input: LoopbusTraceInsert): LoopbusTraceRecord {
    const seq = this.nextSeq('loopbus_trace', 'cycle_id', input.cycleId);
    const encoded = encodeLoopTraceRow(input);
    const result = this.db
      .query(
        `insert into loopbus_trace (
          cycle_id,
          seq,
          step,
          status,
          started_at,
          ended_at,
          detail_json
        ) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.cycleId, seq, encoded.step, input.status, input.startedAt, input.endedAt, encoded.detailJson);
    const row = this.getLoopTraceById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error('failed to load inserted loopbus_trace');
    }
    return row;
  }

  updateLoopTrace(id: number, input: LoopbusTraceUpdate): LoopbusTraceRecord {
    const current = this.getLoopTraceById(id);
    if (!current) {
      throw new Error("failed to load current loopbus_trace");
    }
    const next = mergeLoopTraceRecord(current, input);
    const encoded = encodeLoopTraceRow(next);
    this.db
      .query(
        `update loopbus_trace
         set step = ?,
             status = ?,
             ended_at = ?,
             detail_json = ?
         where id = ?`,
      )
      .run(encoded.step, next.status, next.endedAt, encoded.detailJson, id);
    const row = this.getLoopTraceById(id);
    if (!row) {
      throw new Error("failed to load updated loopbus_trace");
    }
    return row;
  }

  getLoopTraceById(id: number): LoopbusTraceRecord | null {
    const row = this.db
      .query(
        `select id, cycle_id, seq, step, status, started_at, ended_at, detail_json
         from loopbus_trace where id = ?`,
      )
      .get(id) as StoredLoopTraceRow | null;
    if (!row) {
      return null;
    }
    return decodeLoopTraceRow(row);
  }

  listLoopTracesByCycle(cycleId: number, afterId = 0, limit = 200): LoopbusTraceRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from loopbus_trace where cycle_id = ? and id > ? order by id asc limit ?`)
      .all(cycleId, afterId, safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getLoopTraceById(row.id)).filter((row): row is LoopbusTraceRecord => row !== null);
  }

  listLoopTracesAfter(afterId = 0, limit = 200): LoopbusTraceRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from loopbus_trace where id > ? order by id asc limit ?`)
      .all(afterId, safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getLoopTraceById(row.id)).filter((row): row is LoopbusTraceRecord => row !== null);
  }

  listLoopTracesByRef(ref: string, limit = 200): LoopbusTraceRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from loopbus_trace order by started_at desc, id desc`)
      .all() as Array<{ id: number }>;
    const matchedDescending: LoopbusTraceRecord[] = [];
    for (const row of rows) {
      const record = this.getLoopTraceById(row.id);
      if (!record) {
        continue;
      }
      if (
        record.refs.some((item) => item.ref === ref) ||
        record.links.some((item) => item.ref?.ref === ref)
      ) {
        matchedDescending.push(record);
      }
      if (matchedDescending.length >= safeLimit) {
        break;
      }
    }
    return matchedDescending.reverse();
  }

  listLoopTracesBefore(beforeId: number, limit = 200): LoopbusTraceRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from loopbus_trace where id < ? order by id desc limit ?`)
      .all(beforeId, safeLimit) as Array<{ id: number }>;
    rows.reverse();
    return rows.map((row) => this.getLoopTraceById(row.id)).filter((row): row is LoopbusTraceRecord => row !== null);
  }

  listLoopTracesPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<LoopbusTraceRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from loopbus_trace
             where started_at < ? or (started_at = ? and id < ?)
             order by started_at desc, id desc
             limit ?`,
          )
          .all(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId, safeLimit + 1) as Array<{
          id: number;
        }>)
      : (this.db
          .query(
            `select id
             from loopbus_trace
             order by started_at desc, id desc
             limit ?`,
          )
          .all(safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getLoopTraceById(row.id))
      .filter((row): row is LoopbusTraceRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(
        recordsDescending.map((record) => ({
          ...record,
          createdAt: record.startedAt,
        })),
        hasMoreBefore,
      ),
      hasMoreBefore,
    };
  }

  appendApiCall(input: ApiCallInsert): ApiCallRecord {
    const createdAt = input.createdAt ?? Date.now();
    const result = this.db
      .query(
        `insert into api_call (
          model_call_id,
          created_at,
          request_json,
          response_json,
          error_json
        ) values (?, ?, ?, ?, ?)`,
      )
      .run(
        input.modelCallId,
        createdAt,
        toJson(input.request),
        input.response === undefined ? null : toJson(input.response),
        input.error === undefined ? null : toJson(input.error),
      );
    const row = this.getApiCallById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error('failed to load inserted api_call');
    }
    return row;
  }

  getApiCallById(id: number): ApiCallRecord | null {
    const row = this.db
      .query(
        `select id, model_call_id, created_at, request_json, response_json, error_json
         from api_call where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          model_call_id: number;
          created_at: number;
          request_json: string;
          response_json: string | null;
          error_json: string | null;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      modelCallId: row.model_call_id,
      createdAt: row.created_at,
      request: parseJson(row.request_json, null),
      response: row.response_json ? parseJson(row.response_json, null) : undefined,
      error: row.error_json ? parseJson(row.error_json, null) : undefined,
    };
  }

  listApiCallsByModelCall(modelCallId: number): ApiCallRecord[] {
    const rows = this.db
      .query(`select id from api_call where model_call_id = ? order by id asc`)
      .all(modelCallId) as Array<{ id: number }>;
    return rows.map((row) => this.getApiCallById(row.id)).filter((row): row is ApiCallRecord => row !== null);
  }

  listApiCallsAfter(afterId = 0, limit = 200): ApiCallRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from api_call where id > ? order by id asc limit ?`)
      .all(afterId, safeLimit) as Array<{ id: number }>;
    return rows.map((row) => this.getApiCallById(row.id)).filter((row): row is ApiCallRecord => row !== null);
  }

  listApiCallsBefore(beforeId: number, limit = 200): ApiCallRecord[] {
    if (beforeId <= 0) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(limit, 1_000));
    const rows = this.db
      .query(`select id from api_call where id < ? order by id desc limit ?`)
      .all(beforeId, safeLimit) as Array<{ id: number }>;
    rows.reverse();
    return rows.map((row) => this.getApiCallById(row.id)).filter((row): row is ApiCallRecord => row !== null);
  }

  listApiCallsPage(input?: {
    before?: ReverseTimeCursor;
    limit?: number;
  }): ReversePage<ApiCallRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from api_call
             where created_at < ? or (created_at = ? and id < ?)
             order by created_at desc, id desc
             limit ?`,
          )
          .all(input.before.beforeTimeMs, input.before.beforeTimeMs, input.before.beforeId, safeLimit + 1) as Array<{
          id: number;
        }>)
      : (this.db
          .query(
            `select id
             from api_call
             order by created_at desc, id desc
             limit ?`,
          )
          .all(safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getApiCallById(row.id))
      .filter((row): row is ApiCallRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(recordsDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  appendTerminalActivity(input: TerminalActivityInsert): TerminalActivityRecord {
    const createdAt = input.createdAt ?? Date.now();
    const result = this.db
      .query(
        `insert into terminal_activity (
          terminal_id,
          created_at,
          kind,
          cycle_id,
          role,
          channel,
          title,
          content,
          tool_json,
          detail_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.terminalId,
        createdAt,
        input.kind,
        input.cycleId ?? null,
        input.role ?? null,
        input.channel ?? null,
        input.title,
        input.content,
        input.tool === undefined ? null : toJson(input.tool),
        input.detail === undefined ? null : toJson(input.detail),
      );
    const row = this.getTerminalActivityById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error("failed to load inserted terminal_activity");
    }
    return row;
  }

  getTerminalActivityById(id: number): TerminalActivityRecord | null {
    const row = this.db
      .query(
        `select id, terminal_id, created_at, kind, cycle_id, role, channel, title, content, tool_json, detail_json
         from terminal_activity where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          terminal_id: string;
          created_at: number;
          kind: TerminalActivityRecord["kind"];
          cycle_id: number | null;
          role: TerminalActivityRecord["role"] | null;
          channel: TerminalActivityRecord["channel"] | null;
          title: string;
          content: string;
          tool_json: string | null;
          detail_json: string | null;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      terminalId: row.terminal_id,
      createdAt: row.created_at,
      kind: row.kind,
      cycleId: row.cycle_id,
      role: row.role ?? undefined,
      channel: row.channel ?? undefined,
      title: row.title,
      content: row.content,
      tool: row.tool_json ? parseJson(row.tool_json, undefined) : undefined,
      detail: row.detail_json ? parseJson(row.detail_json, undefined) : undefined,
    };
  }

  listTerminalActivityPage(
    terminalId: string,
    input?: {
      before?: ReverseTimeCursor;
      limit?: number;
    },
  ): ReversePage<TerminalActivityRecord> {
    const safeLimit = resolvePageLimit(input?.limit);
    const rows = input?.before
      ? (this.db
          .query(
            `select id
             from terminal_activity
             where terminal_id = ? and (created_at < ? or (created_at = ? and id < ?))
             order by created_at desc, id desc
             limit ?`,
          )
          .all(
            terminalId,
            input.before.beforeTimeMs,
            input.before.beforeTimeMs,
            input.before.beforeId,
            safeLimit + 1,
          ) as Array<{ id: number }>)
      : (this.db
          .query(
            `select id
             from terminal_activity
             where terminal_id = ?
             order by created_at desc, id desc
             limit ?`,
          )
          .all(terminalId, safeLimit + 1) as Array<{ id: number }>);

    const hasMoreBefore = rows.length > safeLimit;
    const visibleRows = hasMoreBefore ? rows.slice(0, safeLimit) : rows;
    const recordsDescending = visibleRows
      .map((row) => this.getTerminalActivityById(row.id))
      .filter((row): row is TerminalActivityRecord => row !== null);
    return {
      items: recordsDescending.slice().reverse(),
      nextBefore: buildNextCursor(recordsDescending, hasMoreBefore),
      hasMoreBefore,
    };
  }

  private nextSeq(table: 'session_cycle' | 'session_block' | 'loopbus_trace', scopeColumn?: 'cycle_id', scopeValue?: number): number {
    if (scopeColumn && scopeValue !== undefined) {
      const row = this.db
        .query(`select max(seq) as value from ${table} where ${scopeColumn} = ?`)
        .get(scopeValue) as { value: number | null } | null;
      return (row?.value ?? 0) + 1;
    }
    const row = this.db.query(`select max(seq) as value from ${table}`).get() as { value: number | null } | null;
    return (row?.value ?? 0) + 1;
  }

  private nextBlockAssetSeq(blockId: number): number {
    const row = this.db
      .query(`select max(seq) as value from session_block_asset where block_id = ?`)
      .get(blockId) as { value: number | null } | null;
    return (row?.value ?? 0) + 1;
  }

  private ensureHeadRow(): void {
    const row = this.db.query(`select id from session_head where id = 1`).get() as { id: number } | null;
    if (row) {
      return;
    }
    this.db.query(`insert into session_head (id, head_cycle_id, updated_at) values (1, null, ?)`).run(Date.now());
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists session_head (
        id integer primary key check (id = 1),
        head_cycle_id integer,
        updated_at integer not null
      );

      create table if not exists session_cycle (
        id integer primary key autoincrement,
        seq integer not null unique,
        prev_cycle_id integer,
        created_at integer not null,
        wake_json text not null,
        collected_inputs_json text not null,
        extends_json text not null,
        result_json text not null
      );

      create index if not exists idx_session_cycle_prev on session_cycle(prev_cycle_id);
      create index if not exists idx_session_cycle_created on session_cycle(created_at desc, id desc);

      create table if not exists model_call (
        id integer primary key autoincrement,
        cycle_id integer not null,
        created_at integer not null,
        status text not null default 'done',
        completed_at integer,
        provider text not null,
        model text not null,
        request_json text not null,
        response_json text,
        error_json text,
        trace_json text,
        outcome_json text
      );

      create index if not exists idx_model_call_cycle on model_call(cycle_id);
      create index if not exists idx_model_call_created on model_call(created_at desc, id desc);

      create table if not exists session_block (
        id integer primary key autoincrement,
        seq integer not null unique,
        cycle_id integer,
        created_at integer not null,
        updated_at integer not null,
        message_id text,
        projection_json text,
        visible_at integer,
        attention_state text,
        attention_loaded_at integer,
        role text not null,
        channel text not null,
        chat_id text,
        format text not null,
        content text not null,
        tool_json text
      );

      create index if not exists idx_session_block_cycle on session_block(cycle_id, id asc);
      create index if not exists idx_session_block_created on session_block(created_at desc, id desc);

      create table if not exists session_asset (
        id text primary key,
        kind text not null,
        created_at integer not null,
        name text not null,
        mime_type text not null,
        size_bytes integer not null,
        relative_path text not null
      );

      create table if not exists session_block_asset (
        block_id integer not null,
        asset_id text not null,
        seq integer not null,
        primary key (block_id, asset_id)
      );

      create index if not exists idx_session_block_asset_block on session_block_asset(block_id, seq asc);
      create index if not exists idx_session_block_asset_asset on session_block_asset(asset_id, block_id asc);

      create table if not exists loopbus_state_log (
        id integer primary key autoincrement,
        timestamp integer not null,
        state_version integer not null,
        event text not null,
        prev_hash text,
        state_hash text not null,
        patch_json text not null
      );

      create index if not exists idx_loopbus_state_log_timestamp on loopbus_state_log(timestamp desc, id desc);

      create table if not exists loopbus_trace (
        id integer primary key autoincrement,
        cycle_id integer not null,
        seq integer not null,
        step text not null,
        status text not null,
        started_at integer not null,
        ended_at integer not null,
        detail_json text not null
      );

      create index if not exists idx_loopbus_trace_cycle on loopbus_trace(cycle_id, id asc);
      create index if not exists idx_loopbus_trace_started on loopbus_trace(started_at desc, id desc);

      create table if not exists api_call (
        id integer primary key autoincrement,
        model_call_id integer not null,
        created_at integer not null,
        request_json text not null,
        response_json text,
        error_json text
      );

      create index if not exists idx_api_call_model_call on api_call(model_call_id, id asc);
      create index if not exists idx_api_call_created on api_call(created_at desc, id desc);

      create table if not exists terminal_activity (
        id integer primary key autoincrement,
        terminal_id text not null,
        created_at integer not null,
        kind text not null,
        cycle_id integer,
        role text,
        channel text,
        title text not null,
        content text not null,
        tool_json text,
        detail_json text
      );

      create index if not exists idx_terminal_activity_terminal_created on terminal_activity(terminal_id, created_at desc, id desc);
    `);

    this.ensureColumn("model_call", "status", "alter table model_call add column status text not null default 'done'");
    this.ensureColumn("model_call", "completed_at", "alter table model_call add column completed_at integer");
    this.ensureColumn("model_call", "trace_json", "alter table model_call add column trace_json text");
    this.ensureColumn("model_call", "outcome_json", "alter table model_call add column outcome_json text");
    this.ensureColumn("session_block", "chat_id", "alter table session_block add column chat_id text");
    this.ensureColumn("session_block", "updated_at", "alter table session_block add column updated_at integer");
    this.ensureColumn("session_block", "message_id", "alter table session_block add column message_id text");
    this.ensureColumn("session_block", "projection_json", "alter table session_block add column projection_json text");
    this.ensureColumn("session_block", "visible_at", "alter table session_block add column visible_at integer");
    this.ensureColumn("session_block", "attention_state", "alter table session_block add column attention_state text");
    this.ensureColumn("session_block", "attention_loaded_at", "alter table session_block add column attention_loaded_at integer");
    this.db.exec(`update session_block set updated_at = coalesce(updated_at, created_at);`);
    this.db.exec(
      `create unique index if not exists idx_session_block_message_id on session_block(message_id) where message_id is not null;`,
    );
    this.ensureModelCallCycleMultiplicity();
    this.db.query(`update model_call set status = 'done' where status is null or status = ''`).run();
  }

  private ensureColumn(tableName: string, columnName: string, ddl: string): void {
    const columns = this.db.query(`pragma table_info(${tableName})`).all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === columnName)) {
      return;
    }
    this.db.exec(ddl);
  }

  private ensureModelCallCycleMultiplicity(): void {
    const row = this.db
      .query(`select sql from sqlite_master where type = 'table' and name = 'model_call'`)
      .get() as { sql: string | null } | null;
    const sql = row?.sql ?? "";
    if (!/cycle_id\s+integer\s+not\s+null\s+unique/i.test(sql)) {
      return;
    }

    this.db.exec(`
      begin;
      create table model_call_v2 (
        id integer primary key autoincrement,
        cycle_id integer not null,
        created_at integer not null,
        status text not null default 'done',
        completed_at integer,
        provider text not null,
        model text not null,
        request_json text not null,
        response_json text,
        error_json text,
        trace_json text,
        outcome_json text
      );
      insert into model_call_v2 (
        id,
        cycle_id,
        created_at,
        status,
        completed_at,
        provider,
        model,
        request_json,
        response_json,
        error_json,
        trace_json,
        outcome_json
      )
      select
        id,
        cycle_id,
        created_at,
        status,
        completed_at,
        provider,
        model,
        request_json,
        response_json,
        error_json,
        trace_json,
        outcome_json
      from model_call
      order by id asc;
      drop table model_call;
      alter table model_call_v2 rename to model_call;
      create index if not exists idx_model_call_cycle on model_call(cycle_id);
      create index if not exists idx_model_call_created on model_call(created_at desc, id desc);
      commit;
    `);
  }
}
