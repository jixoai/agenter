import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  matchesAuthDraftFilter,
  normalizeAuthDraftFilter,
  parseAuthDraftState,
  stableSerializeAuthDraftState,
  type AuthDraftCreateResult,
  type AuthDraftDeleteResult,
  type AuthDraftEntry,
  type AuthDraftEvent,
  type AuthDraftFilter,
  type AuthDraftKind,
  type AuthDraftSaveResult,
  type AuthDraftSnapshot,
  type AuthDraftState,
  type AuthDraftWriteInput,
} from "./auth-draft-types";

const AUTH_DRAFT_SCHEMA_VERSION = 2;
const now = (): number => Date.now();

type AuthDraftEntryRow = {
  draft_id: string;
  kind: AuthDraftKind;
  state_json: string;
  version: number;
  created_at: number;
  updated_at: number;
};

type AuthDraftEventRow = {
  event_id: number;
  draft_id: string;
  kind: AuthDraftKind;
  op: "upsert" | "delete";
  state_json: string | null;
  version: number;
  draft_created_at: number;
  created_at: number;
};

type InternalAuthDraftEvent =
  | {
      authId: string;
      eventId: number;
      timestamp: number;
      kind: "upsert";
      entry: AuthDraftEntry;
    }
  | {
      authId: string;
      eventId: number;
      timestamp: number;
      kind: "delete";
      draftId: string;
      draftKind: AuthDraftKind;
      version: number;
    };

type AuthDraftListener = (event: InternalAuthDraftEvent) => void;

type SqliteTableInfoRow = {
  name: string;
};

const mapEntryRow = (row: AuthDraftEntryRow): AuthDraftEntry => ({
  draftId: row.draft_id,
  kind: row.kind,
  state: parseAuthDraftState(row.kind, JSON.parse(row.state_json)),
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPublicEvent = (row: AuthDraftEventRow): AuthDraftEvent =>
  row.op === "upsert"
    ? {
        eventId: row.event_id,
        timestamp: row.created_at,
        kind: "upsert",
        entry: {
          draftId: row.draft_id,
          kind: row.kind,
          state: parseAuthDraftState(row.kind, JSON.parse(row.state_json ?? "null")),
          version: row.version,
          createdAt: row.draft_created_at,
          updatedAt: row.created_at,
        },
      }
    : {
        eventId: row.event_id,
        timestamp: row.created_at,
        kind: "delete",
        draftId: row.draft_id,
        draftKind: row.kind,
        version: row.version,
      };

export const resolveAuthDraftDbPath = (homeDir = homedir()): string =>
  join(homeDir, ".agenter", "auth-drafts.db");

export class AuthDraftStore {
  private readonly db: Database;
  private readonly listeners = new Set<AuthDraftListener>();

  constructor(filePath = resolveAuthDraftDbPath()) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  list(authId: string, filter?: AuthDraftFilter): AuthDraftSnapshot {
    const normalized = normalizeAuthDraftFilter(filter);
    const rows = this.db
      .query(
        `select draft_id, kind, state_json, version, created_at, updated_at
         from auth_draft_entry
         where auth_id = ?
         order by updated_at desc, draft_id asc`,
      )
      .all(authId) as AuthDraftEntryRow[];
    return {
      lastEventId: this.readLastEventId(authId),
      items: rows.map(mapEntryRow).filter((entry) => matchesAuthDraftFilter(entry, normalized)),
    };
  }

  get(authId: string, draftId: string): AuthDraftEntry | null {
    const row = this.readEntryRow(authId, draftId);
    return row ? mapEntryRow(row) : null;
  }

  create(authId: string, input: AuthDraftWriteInput): AuthDraftCreateResult {
    const draftId = randomUUID();
    const createdAt = now();
    const normalizedState = parseAuthDraftState(input.kind, input.state);
    const serialized = stableSerializeAuthDraftState(input.kind, normalizedState);
    let emittedEvent: InternalAuthDraftEvent | null = null;
    this.db.exec("begin immediate");
    try {
      this.db
        .query(
          `insert into auth_draft_entry (auth_id, draft_id, kind, state_json, version, created_at, updated_at)
           values (?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(authId, draftId, input.kind, serialized, createdAt, createdAt);
      const eventResult = this.db
        .query(
          `insert into auth_draft_event (auth_id, draft_id, kind, op, state_json, version, draft_created_at, created_at)
           values (?, ?, ?, 'upsert', ?, 1, ?, ?)`,
        )
        .run(authId, draftId, input.kind, serialized, createdAt, createdAt);
      const entry: AuthDraftEntry = {
        draftId,
        kind: input.kind,
        state: normalizedState,
        version: 1,
        createdAt,
        updatedAt: createdAt,
      };
      emittedEvent = {
        authId,
        eventId: Number(eventResult.lastInsertRowid),
        timestamp: createdAt,
        kind: "upsert",
        entry,
      };
      this.db.exec("commit");
      this.emit(emittedEvent);
      return {
        eventId: emittedEvent.eventId,
        entry,
      };
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
  }

  save(
    authId: string,
    input: {
      draftId: string;
      kind: AuthDraftKind;
      state: AuthDraftState;
      baseVersion?: number;
    },
  ): AuthDraftSaveResult {
    const serialized = stableSerializeAuthDraftState(input.kind, input.state);
    let emittedEvent: InternalAuthDraftEvent | null = null;
    let committed = false;
    this.db.exec("begin immediate");
    try {
      const existing = this.readEntryRow(authId, input.draftId);
      if (!existing) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "not_found",
          latest: null,
        };
      }
      if (existing.kind !== input.kind) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "conflict",
          latest: mapEntryRow(existing),
        };
      }
      if (input.baseVersion !== undefined && existing.version !== input.baseVersion) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "conflict",
          latest: mapEntryRow(existing),
        };
      }
      if (existing.state_json === serialized) {
        this.db.exec("commit");
        return {
          ok: true,
          changed: false,
          eventId: null,
          entry: mapEntryRow(existing),
        };
      }

      const timestamp = now();
      const version = existing.version + 1;
      this.db
        .query(
          `update auth_draft_entry
           set state_json = ?, version = ?, updated_at = ?
           where auth_id = ? and draft_id = ?`,
        )
        .run(serialized, version, timestamp, authId, input.draftId);
      const eventResult = this.db
        .query(
          `insert into auth_draft_event (auth_id, draft_id, kind, op, state_json, version, draft_created_at, created_at)
           values (?, ?, ?, 'upsert', ?, ?, ?, ?)`,
        )
        .run(authId, input.draftId, input.kind, serialized, version, existing.created_at, timestamp);
      const entry: AuthDraftEntry = {
        draftId: input.draftId,
        kind: input.kind,
        state: parseAuthDraftState(input.kind, input.state),
        version,
        createdAt: existing.created_at,
        updatedAt: timestamp,
      };
      emittedEvent = {
        authId,
        eventId: Number(eventResult.lastInsertRowid),
        timestamp,
        kind: "upsert",
        entry,
      };
      this.db.exec("commit");
      committed = true;
      return {
        ok: true,
        changed: true,
        eventId: emittedEvent.eventId,
        entry,
      };
    } catch (error) {
      try {
        this.db.exec("rollback");
      } catch {
        // Ignore rollback races after failed writes.
      }
      throw error;
    } finally {
      if (committed && emittedEvent) {
        this.emit(emittedEvent);
      }
    }
  }

  delete(
    authId: string,
    input: {
      draftId: string;
      baseVersion?: number;
    },
  ): AuthDraftDeleteResult {
    let emittedEvent: InternalAuthDraftEvent | null = null;
    let committed = false;
    this.db.exec("begin immediate");
    try {
      const existing = this.readEntryRow(authId, input.draftId);
      if (!existing) {
        this.db.exec("commit");
        return {
          ok: true,
          removed: false,
          eventId: null,
          draftId: input.draftId,
          kind: null,
          version: null,
        };
      }
      if (input.baseVersion !== undefined && existing.version !== input.baseVersion) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "conflict",
          latest: mapEntryRow(existing),
        };
      }

      const timestamp = now();
      const version = existing.version + 1;
      this.db.query(`delete from auth_draft_entry where auth_id = ? and draft_id = ?`).run(authId, input.draftId);
      const eventResult = this.db
        .query(
          `insert into auth_draft_event (auth_id, draft_id, kind, op, state_json, version, draft_created_at, created_at)
           values (?, ?, ?, 'delete', null, ?, ?, ?)`,
        )
        .run(authId, input.draftId, existing.kind, version, existing.created_at, timestamp);
      emittedEvent = {
        authId,
        eventId: Number(eventResult.lastInsertRowid),
        timestamp,
        kind: "delete",
        draftId: input.draftId,
        draftKind: existing.kind,
        version,
      };
      this.db.exec("commit");
      committed = true;
      return {
        ok: true,
        removed: true,
        eventId: emittedEvent.eventId,
        draftId: input.draftId,
        kind: existing.kind,
        version,
      };
    } catch (error) {
      try {
        this.db.exec("rollback");
      } catch {
        // Ignore rollback races after failed writes.
      }
      throw error;
    } finally {
      if (committed && emittedEvent) {
        this.emit(emittedEvent);
      }
    }
  }

  getEventsAfter(authId: string, afterEventId = 0, filter?: AuthDraftFilter): AuthDraftEvent[] {
    const normalized = normalizeAuthDraftFilter(filter);
    const rows = this.db
      .query(
        `select event_id, draft_id, kind, op, state_json, version, draft_created_at, created_at
         from auth_draft_event
         where auth_id = ? and event_id > ?
         order by event_id asc`,
      )
      .all(authId, afterEventId) as AuthDraftEventRow[];
    return rows
      .map(toPublicEvent)
      .filter((event) =>
        matchesAuthDraftFilter(
          event.kind === "upsert"
            ? {
                draftId: event.entry.draftId,
                kind: event.entry.kind,
              }
            : {
                draftId: event.draftId,
                kind: event.draftKind,
              },
          normalized,
        ),
      );
  }

  onEvent(listener: AuthDraftListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: InternalAuthDraftEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private migrate(): void {
    this.db.exec("pragma journal_mode = wal");
    this.db.exec("begin immediate");
    try {
      this.db.exec("create table if not exists auth_draft_meta (schema_version integer not null) strict");
      const metaRow = this.db
        .query(`select schema_version from auth_draft_meta limit 1`)
        .get() as { schema_version: number } | null;
      if (!metaRow) {
        this.db.query(`insert into auth_draft_meta (schema_version) values (0)`).run();
      } else if (metaRow.schema_version > AUTH_DRAFT_SCHEMA_VERSION) {
        throw new Error(
          `unsupported auth draft schema version ${metaRow.schema_version}; expected <= ${AUTH_DRAFT_SCHEMA_VERSION}`,
        );
      }

      this.db.exec(`
        create table if not exists auth_draft_entry (
          auth_id text not null,
          draft_id text not null,
          kind text not null,
          state_json text not null,
          version integer not null,
          created_at integer not null,
          updated_at integer not null,
          primary key (auth_id, draft_id)
        ) strict
      `);
      this.db.exec(`
        create table if not exists auth_draft_event (
          event_id integer primary key autoincrement,
          auth_id text not null,
          draft_id text not null,
          kind text not null,
          op text not null,
          state_json text,
          version integer not null,
          draft_created_at integer not null,
          created_at integer not null
        ) strict
      `);

      const currentVersion = metaRow?.schema_version ?? 0;
      if (currentVersion < 2) {
        this.migrateToSchemaVersion2();
        this.db.query(`update auth_draft_meta set schema_version = ?`).run(AUTH_DRAFT_SCHEMA_VERSION);
      }

      this.db.exec(`
        create index if not exists auth_draft_entry_auth_kind_updated_idx
        on auth_draft_entry (auth_id, kind, updated_at desc, draft_id asc)
      `);
      this.db.exec(`
        create index if not exists auth_draft_event_auth_event_idx
        on auth_draft_event (auth_id, event_id asc)
      `);
      this.db.exec("commit");
    } catch (error) {
      try {
        this.db.exec("rollback");
      } catch {
        // Ignore rollback races if SQLite already aborted the migration transaction.
      }
      throw error;
    }
  }

  private migrateToSchemaVersion2(): void {
    if (!this.hasColumn("auth_draft_event", "draft_created_at")) {
      this.db.exec(`
        alter table auth_draft_event
        add column draft_created_at integer not null default 0
      `);
    }
    this.db.exec(`
      update auth_draft_event
      set draft_created_at = coalesce(
        nullif(draft_created_at, 0),
        (
          select entry.created_at
          from auth_draft_entry as entry
          where entry.auth_id = auth_draft_event.auth_id
            and entry.draft_id = auth_draft_event.draft_id
        ),
        (
          select min(seed.created_at)
          from auth_draft_event as seed
          where seed.auth_id = auth_draft_event.auth_id
            and seed.draft_id = auth_draft_event.draft_id
            and seed.op = 'upsert'
        ),
        created_at
      )
      where draft_created_at = 0
    `);
  }

  private hasColumn(tableName: "auth_draft_event", columnName: string): boolean {
    const rows = this.db.query(`pragma table_info(${tableName})`).all() as SqliteTableInfoRow[];
    return rows.some((row) => row.name === columnName);
  }

  private readEntryRow(authId: string, draftId: string): AuthDraftEntryRow | null {
    return (this.db
      .query(
        `select draft_id, kind, state_json, version, created_at, updated_at
         from auth_draft_entry
         where auth_id = ? and draft_id = ?`,
      )
      .get(authId, draftId) as AuthDraftEntryRow | null) ?? null;
  }

  private readLastEventId(authId: string): number {
    const row = this.db
      .query(`select max(event_id) as event_id from auth_draft_event where auth_id = ?`)
      .get(authId) as { event_id: number | null } | null;
    return row?.event_id ?? 0;
  }
}
