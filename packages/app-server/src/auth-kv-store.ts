import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { stableStringify } from "./loopbus-kernel";
import {
  matchesAuthKvFilter,
  normalizeAuthKvFilter,
  type AuthKvDeleteResult,
  type AuthKvEntry,
  type AuthKvEvent,
  type AuthKvFilter,
  type AuthKvSetResult,
  type AuthKvSnapshot,
  type JsonValue,
} from "./auth-kv-types";

const AUTH_KV_SCHEMA_VERSION = 1;
const now = (): number => Date.now();

type AuthKvEntryRow = {
  key: string;
  value_json: string;
  version: number;
  updated_at: number;
};

type AuthKvEventRow = {
  event_id: number;
  key: string;
  kind: "set" | "delete";
  value_json: string | null;
  version: number;
  created_at: number;
};

type InternalAuthKvEvent =
  | {
      authId: string;
      eventId: number;
      timestamp: number;
      kind: "set";
      entry: AuthKvEntry;
    }
  | {
      authId: string;
      eventId: number;
      timestamp: number;
      kind: "delete";
      key: string;
      version: number;
    };

type AuthKvListener = (event: InternalAuthKvEvent) => void;

const parseJsonValue = (value: string): JsonValue => JSON.parse(value) as JsonValue;

const mapEntryRow = (row: AuthKvEntryRow): AuthKvEntry => ({
  key: row.key,
  value: parseJsonValue(row.value_json),
  version: row.version,
  updatedAt: row.updated_at,
});

const toPublicEvent = (row: AuthKvEventRow): AuthKvEvent =>
  row.kind === "set"
    ? {
        eventId: row.event_id,
        timestamp: row.created_at,
        kind: "set",
        entry: {
          key: row.key,
          value: parseJsonValue(row.value_json ?? "null"),
          version: row.version,
          updatedAt: row.created_at,
        },
      }
    : {
        eventId: row.event_id,
        timestamp: row.created_at,
        kind: "delete",
        key: row.key,
        version: row.version,
      };

export const resolveAuthKvDbPath = (homeDir = homedir()): string => join(homeDir, ".agenter", "auth-kv.db");

export class AuthKvStore {
  private readonly db: Database;
  private readonly listeners = new Set<AuthKvListener>();

  constructor(filePath = resolveAuthKvDbPath()) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  snapshot(authId: string, filter?: AuthKvFilter): AuthKvSnapshot {
    const normalized = normalizeAuthKvFilter(filter);
    const rows = this.db
      .query(`select key, value_json, version, updated_at from auth_kv_entry where auth_id = ? order by key asc`)
      .all(authId) as AuthKvEntryRow[];
    return {
      lastEventId: this.readLastEventId(authId),
      items: rows.map(mapEntryRow).filter((entry) => matchesAuthKvFilter(entry.key, normalized)),
    };
  }

  getEventsAfter(authId: string, afterEventId = 0, filter?: AuthKvFilter): AuthKvEvent[] {
    const normalized = normalizeAuthKvFilter(filter);
    const rows = this.db
      .query(
        `select event_id, key, kind, value_json, version, created_at
         from auth_kv_event
         where auth_id = ? and event_id > ?
         order by event_id asc`,
      )
      .all(authId, afterEventId) as AuthKvEventRow[];
    return rows.map(toPublicEvent).filter((event) => matchesAuthKvFilter(event.kind === "set" ? event.entry.key : event.key, normalized));
  }

  onEvent(listener: AuthKvListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(
    authId: string,
    input: {
      key: string;
      value: JsonValue;
      baseVersion?: number | null;
    },
  ): AuthKvSetResult {
    const serialized = stableStringify(input.value);
    let emittedEvent: InternalAuthKvEvent | null = null;
    let committed = false;
    this.db.exec("begin immediate");
    try {
      const existing = this.readEntryRow(authId, input.key);
      if (!this.matchesBaseVersion(existing, input.baseVersion)) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "conflict",
          latest: existing ? mapEntryRow(existing) : null,
        };
      }
      if (existing && existing.value_json === serialized) {
        this.db.exec("commit");
        return {
          ok: true,
          changed: false,
          eventId: null,
          entry: mapEntryRow(existing),
        };
      }

      const timestamp = now();
      const version = this.nextVersion(authId, input.key, existing?.version);
      this.db
        .query(
          `insert into auth_kv_entry (auth_id, key, value_json, version, updated_at)
           values (?, ?, ?, ?, ?)
           on conflict(auth_id, key) do update set
             value_json = excluded.value_json,
             version = excluded.version,
             updated_at = excluded.updated_at`,
        )
        .run(authId, input.key, serialized, version, timestamp);
      const eventResult = this.db
        .query(
          `insert into auth_kv_event (auth_id, key, kind, value_json, version, created_at)
           values (?, ?, 'set', ?, ?, ?)`,
        )
        .run(authId, input.key, serialized, version, timestamp);
      const entry: AuthKvEntry = {
        key: input.key,
        value: parseJsonValue(serialized),
        version,
        updatedAt: timestamp,
      };
      emittedEvent = {
        authId,
        eventId: Number(eventResult.lastInsertRowid),
        timestamp,
        kind: "set",
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
      key: string;
      baseVersion?: number | null;
    },
  ): AuthKvDeleteResult {
    let emittedEvent: InternalAuthKvEvent | null = null;
    let committed = false;
    this.db.exec("begin immediate");
    try {
      const existing = this.readEntryRow(authId, input.key);
      if (!this.matchesBaseVersion(existing, input.baseVersion)) {
        this.db.exec("rollback");
        return {
          ok: false,
          reason: "conflict",
          latest: existing ? mapEntryRow(existing) : null,
        };
      }
      if (!existing) {
        this.db.exec("commit");
        return {
          ok: true,
          removed: false,
          eventId: null,
          key: input.key,
          version: null,
        };
      }

      const timestamp = now();
      const version = this.nextVersion(authId, input.key, existing.version);
      this.db.query(`delete from auth_kv_entry where auth_id = ? and key = ?`).run(authId, input.key);
      const eventResult = this.db
        .query(
          `insert into auth_kv_event (auth_id, key, kind, value_json, version, created_at)
           values (?, ?, 'delete', null, ?, ?)`,
        )
        .run(authId, input.key, version, timestamp);
      emittedEvent = {
        authId,
        eventId: Number(eventResult.lastInsertRowid),
        timestamp,
        kind: "delete",
        key: input.key,
        version,
      };
      this.db.exec("commit");
      committed = true;
      return {
        ok: true,
        removed: true,
        eventId: emittedEvent.eventId,
        key: input.key,
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

  private readEntryRow(authId: string, key: string): AuthKvEntryRow | null {
    return (
      (this.db
        .query(`select key, value_json, version, updated_at from auth_kv_entry where auth_id = ? and key = ?`)
        .get(authId, key) as AuthKvEntryRow | null) ?? null
    );
  }

  private readLastEventId(authId: string): number {
    const row = this.db
      .query(`select max(event_id) as event_id from auth_kv_event where auth_id = ?`)
      .get(authId) as { event_id: number | null } | null;
    return row?.event_id ?? 0;
  }

  private readLatestVersion(authId: string, key: string): number {
    const row = this.db
      .query(
        `select version
         from auth_kv_event
         where auth_id = ? and key = ?
         order by event_id desc
         limit 1`,
      )
      .get(authId, key) as { version: number } | null;
    return row?.version ?? 0;
  }

  private nextVersion(authId: string, key: string, currentVersion?: number): number {
    return (currentVersion ?? this.readLatestVersion(authId, key)) + 1;
  }

  private matchesBaseVersion(existing: AuthKvEntryRow | null, baseVersion: number | null | undefined): boolean {
    if (baseVersion === undefined) {
      return true;
    }
    if (baseVersion === null) {
      return existing === null;
    }
    return existing?.version === baseVersion;
  }

  private emit(event: InternalAuthKvEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private migrate(): void {
    const row = this.db.query(`pragma user_version`).get() as { user_version?: number } | null;
    const version = row?.user_version ?? 0;
    if (version >= AUTH_KV_SCHEMA_VERSION) {
      return;
    }
    this.db.exec(`
      create table if not exists auth_kv_entry (
        auth_id text not null,
        key text not null,
        value_json text not null,
        version integer not null,
        updated_at integer not null,
        primary key (auth_id, key)
      );

      create table if not exists auth_kv_event (
        event_id integer primary key autoincrement,
        auth_id text not null,
        key text not null,
        kind text not null check(kind in ('set', 'delete')),
        value_json text,
        version integer not null,
        created_at integer not null
      );

      create index if not exists auth_kv_event_auth_id_event_id_idx on auth_kv_event(auth_id, event_id);
      pragma user_version = ${AUTH_KV_SCHEMA_VERSION};
    `);
  }
}
