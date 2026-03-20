import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import type {
  ApiCallInsert,
  ApiCallRecord,
  LoopbusTraceInsert,
  LoopbusTraceRecord,
  SessionAssetInsert,
  SessionAssetRecord,
  SessionBlockAssetRecord,
  SessionBlockInsert,
  SessionBlockRecord,
  SessionCycleInsert,
  SessionCycleRecord,
  SessionHeadRecord,
  SessionModelCallInsert,
  SessionModelCallRecord,
  SessionModelCallUpdate,
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
          error_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        `select id, cycle_id, created_at, status, completed_at, provider, model, request_json, response_json, error_json
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
    };
  }

  updateModelCall(id: number, input: SessionModelCallUpdate): SessionModelCallRecord {
    this.db
      .query(
        `update model_call
         set status = coalesce(?, status),
             completed_at = ?,
             response_json = ?,
             error_json = ?
         where id = ?`,
      )
      .run(
        input.status ?? null,
        input.completedAt ?? null,
        input.response === undefined ? null : toJson(input.response),
        input.error === undefined ? null : toJson(input.error),
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
      .query(`select id from model_call where cycle_id = ? limit 1`)
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

  appendBlock(input: SessionBlockInsert): SessionBlockRecord {
    const createdAt = input.createdAt ?? Date.now();
    const seq = this.nextSeq('session_block');
    const result = this.db
      .query(
        `insert into session_block (
          seq,
          cycle_id,
          created_at,
          role,
          channel,
          format,
          content,
          tool_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        seq,
        input.cycleId ?? null,
        createdAt,
        input.role,
        input.channel,
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

  getBlockById(id: number): SessionBlockRecord | null {
    const row = this.db
      .query(
        `select id, seq, cycle_id, created_at, role, channel, format, content, tool_json
         from session_block where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          seq: number;
          cycle_id: number | null;
          created_at: number;
          role: 'user' | 'assistant';
          channel: SessionBlockRecord['channel'];
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
      role: row.role,
      channel: row.channel,
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

  appendLoopTrace(input: LoopbusTraceInsert): LoopbusTraceRecord {
    const seq = this.nextSeq('loopbus_trace', 'cycle_id', input.cycleId);
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
      .run(input.cycleId, seq, input.step, input.status, input.startedAt, input.endedAt, toJson(input.detail ?? {}));
    const row = this.getLoopTraceById(Number(result.lastInsertRowid));
    if (!row) {
      throw new Error('failed to load inserted loopbus_trace');
    }
    return row;
  }

  getLoopTraceById(id: number): LoopbusTraceRecord | null {
    const row = this.db
      .query(
        `select id, cycle_id, seq, step, status, started_at, ended_at, detail_json
         from loopbus_trace where id = ?`,
      )
      .get(id) as
      | {
          id: number;
          cycle_id: number;
          seq: number;
          step: string;
          status: LoopbusTraceRecord['status'];
          started_at: number;
          ended_at: number;
          detail_json: string;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      cycleId: row.cycle_id,
      seq: row.seq,
      step: row.step,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      detail: parseJson(row.detail_json, {}),
    };
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

      create table if not exists model_call (
        id integer primary key autoincrement,
        cycle_id integer not null unique,
        created_at integer not null,
        status text not null default 'done',
        completed_at integer,
        provider text not null,
        model text not null,
        request_json text not null,
        response_json text,
        error_json text
      );

      create index if not exists idx_model_call_cycle on model_call(cycle_id);

      create table if not exists session_block (
        id integer primary key autoincrement,
        seq integer not null unique,
        cycle_id integer,
        created_at integer not null,
        role text not null,
        channel text not null,
        format text not null,
        content text not null,
        tool_json text
      );

      create index if not exists idx_session_block_cycle on session_block(cycle_id, id asc);

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

      create table if not exists api_call (
        id integer primary key autoincrement,
        model_call_id integer not null,
        created_at integer not null,
        request_json text not null,
        response_json text,
        error_json text
      );

      create index if not exists idx_api_call_model_call on api_call(model_call_id, id asc);
    `);

    this.ensureColumn("model_call", "status", "alter table model_call add column status text not null default 'done'");
    this.ensureColumn("model_call", "completed_at", "alter table model_call add column completed_at integer");
    this.db.query(`update model_call set status = 'done' where status is null or status = ''`).run();
  }

  private ensureColumn(tableName: string, columnName: string, ddl: string): void {
    const columns = this.db.query(`pragma table_info(${tableName})`).all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === columnName)) {
      return;
    }
    this.db.exec(ddl);
  }
}
