import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database, type SQLQueryBindings } from "bun:sqlite";

import { assertReadOnlyMcpQuerySql } from "./sql";
import type {
  McpActionRecord,
  McpCapabilitySnapshot,
  McpEnabledRow,
  McpGlobalConfig,
  McpInstalledRow,
  McpInstanceRecord,
  McpJsonObject,
  McpLifecycleState,
  McpProjectEnablement,
  McpQueryInput,
  McpQueryParamValue,
  McpQueryResult,
  McpTransportConfig,
  McpTransportKind,
} from "./types";

const MCP_DB_SCHEMA_VERSION = 1;

const nowIso = (): string => new Date().toISOString();

const toJson = (value: unknown): string => JSON.stringify(value ?? null);

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

const normalizeProjectPath = (projectPath: string): string => {
  const trimmed = projectPath.trim();
  if (!trimmed) {
    throw new Error("projectPath is required");
  }
  return resolve(trimmed);
};

const normalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9_.-]+$/u.test(trimmed)) {
    throw new Error("mcp name must contain only letters, numbers, dot, underscore, or dash");
  }
  return trimmed;
};

const rowToTransport = (row: {
  transport_kind: string;
  command: string | null;
  args_json: string | null;
  url: string | null;
  headers_json: string | null;
  transport_env_json: string | null;
}): McpTransportConfig => {
  if (row.transport_kind === "stdio") {
    if (!row.command) {
      throw new Error("stdio MCP global is missing command");
    }
    return {
      kind: "stdio",
      command: row.command,
      args: parseJson<string[]>(row.args_json, []),
      env: parseJson<Record<string, string>>(row.transport_env_json, {}),
    };
  }
  if (row.transport_kind === "streamable-http" || row.transport_kind === "sse") {
    if (!row.url) {
      throw new Error(`${row.transport_kind} MCP global is missing url`);
    }
    return {
      kind: row.transport_kind,
      url: row.url,
      headers: parseJson<Record<string, string>>(row.headers_json, {}),
    };
  }
  throw new Error(`unknown MCP transport kind: ${row.transport_kind}`);
};

const transportKind = (transport: McpTransportConfig): McpTransportKind => transport.kind;

type SqlNamedBindingValue = string | bigint | NodeJS.TypedArray | number | boolean | null;
type SqlNamedBindings = Record<string, SqlNamedBindingValue>;

const normalizeQueryParamValue = (value: McpQueryParamValue): SqlNamedBindingValue =>
  typeof value === "boolean" ? (value ? 1 : 0) : value;

const normalizeQueryParamKey = (key: string): string => key.replace(/^\$/u, "");

const normalizeQueryParams = (params: Record<string, McpQueryParamValue> | undefined): SqlNamedBindings =>
  Object.fromEntries(
    Object.entries(params ?? {}).map(([key, value]) => [normalizeQueryParamKey(key), normalizeQueryParamValue(value)]),
  );

const runJsonRowQuery = (db: Database, sql: string, params: SqlNamedBindings): Array<Record<string, unknown>> => {
  const statement = db.query<Record<string, unknown>, SqlNamedBindings>(sql);
  return statement.all(params);
};

const normalizeSqlRow = (row: Record<string, unknown>): Record<string, string | number | null> => {
  const normalized: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === "string" || typeof value === "number" || value === null ? value : toJson(value);
  }
  return normalized;
};

export class McpSystemStore {
  private readonly db: Database;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.db.exec(`pragma journal_mode = WAL;`);
    this.db.exec(`pragma foreign_keys = on;`);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  recoverLiveInstancesAsStopped(input: { stoppedAt?: string } = {}): number {
    const stoppedAt = input.stoppedAt ?? nowIso();
    const result = this.db
      .query(
        `update mcp_instances
         set lifecycle = 'stopped',
             updated_at = ?,
             last_stopped_at = coalesce(last_stopped_at, ?)
         where lifecycle in ('starting', 'running')`,
      )
      .run(stoppedAt, stoppedAt);
    return result.changes;
  }

  addGlobal(input: {
    name: string;
    title?: string;
    description?: string;
    transport: McpTransportConfig;
    env?: Record<string, string>;
  }): McpGlobalConfig {
    const name = normalizeName(input.name);
    const now = nowIso();
    const existing = this.getGlobal(name);
    const createdAt = existing?.createdAt ?? now;
    const transport = input.transport;
    this.db
      .query(
        `insert into mcp_globals (
          name, title, description, transport_kind, command, args_json, url, headers_json, env_json,
          transport_env_json, created_at, updated_at, removed_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)
        on conflict(name) do update set
          title = excluded.title,
          description = excluded.description,
          transport_kind = excluded.transport_kind,
          command = excluded.command,
          args_json = excluded.args_json,
          url = excluded.url,
          headers_json = excluded.headers_json,
          env_json = excluded.env_json,
          transport_env_json = excluded.transport_env_json,
          updated_at = excluded.updated_at,
          removed_at = null`,
      )
      .run(
        name,
        input.title ?? null,
        input.description ?? null,
        transportKind(transport),
        transport.kind === "stdio" ? transport.command : null,
        transport.kind === "stdio" ? toJson(transport.args ?? []) : null,
        transport.kind === "stdio" ? null : transport.url,
        transport.kind === "stdio" ? null : toJson(transport.headers ?? {}),
        toJson(input.env ?? {}),
        transport.kind === "stdio" ? toJson(transport.env ?? {}) : null,
        createdAt,
        now,
      );
    return this.requireGlobal(name);
  }

  removeGlobal(input: { name: string; stop?: boolean }): { removed: boolean; blockedProjects: string[] } {
    const name = normalizeName(input.name);
    this.requireGlobal(name);
    const runningRows = this.db
      .query(
        `select project_path
         from mcp_instances
         where name = ? and lifecycle in ('starting', 'running')
         order by project_path`,
      )
      .all(name) as Array<{ project_path: string }>;
    if (runningRows.length > 0 && input.stop !== true) {
      return {
        removed: false,
        blockedProjects: runningRows.map((row) => row.project_path),
      };
    }

    const now = nowIso();
    const remove = this.db.transaction(() => {
      if (input.stop === true) {
        this.db
          .query(
            `update mcp_instances
             set lifecycle = 'stopped', updated_at = ?, last_stopped_at = ?
             where name = ? and lifecycle in ('starting', 'running')`,
          )
          .run(now, now, name);
      }
      this.db
        .query(
          `update mcp_project_enablements
           set enabled = 0, updated_at = ?, disabled_at = ?
           where name = ? and enabled = 1`,
        )
        .run(now, now, name);
      this.db.query(`update mcp_globals set removed_at = ?, updated_at = ? where name = ?`).run(now, now, name);
    });
    remove();
    return { removed: true, blockedProjects: [] };
  }

  getGlobal(name: string): McpGlobalConfig | null {
    const row = this.db
      .query(
        `select name, title, description, transport_kind, command, args_json, url, headers_json,
                env_json, transport_env_json, created_at, updated_at, removed_at
         from mcp_globals
         where name = ? and removed_at is null`,
      )
      .get(normalizeName(name)) as
      | {
          name: string;
          title: string | null;
          description: string | null;
          transport_kind: string;
          command: string | null;
          args_json: string | null;
          url: string | null;
          headers_json: string | null;
          env_json: string | null;
          transport_env_json: string | null;
          created_at: string;
          updated_at: string;
          removed_at: string | null;
        }
      | null;
    if (!row) {
      return null;
    }
    return {
      name: row.name,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      transport: rowToTransport(row),
      env: parseJson<Record<string, string>>(row.env_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      removedAt: row.removed_at ?? undefined,
    };
  }

  requireGlobal(name: string): McpGlobalConfig {
    const global = this.getGlobal(name);
    if (!global) {
      throw new Error(`mcp global not found: ${name}`);
    }
    return global;
  }

  enableProject(input: { name: string; projectPath: string }): McpProjectEnablement {
    const name = normalizeName(input.name);
    this.requireGlobal(name);
    const projectPath = normalizeProjectPath(input.projectPath);
    const now = nowIso();
    const existing = this.getExplicitEnablement(name, projectPath);
    const createdAt = existing?.createdAt ?? now;
    this.db
      .query(
        `insert into mcp_project_enablements (
          name, project_path, enabled, created_at, updated_at, enabled_at, disabled_at, last_used_at
        ) values (?, ?, 1, ?, ?, ?, null, ?)
        on conflict(name, project_path) do update set
          enabled = 1,
          updated_at = excluded.updated_at,
          enabled_at = excluded.enabled_at,
          disabled_at = null`,
      )
      .run(name, projectPath, createdAt, now, now, existing?.lastUsedAt ?? null);
    return this.requireExplicitEnablement(name, projectPath);
  }

  disableProject(input: { name: string; projectPath: string; stop?: boolean }): McpProjectEnablement {
    const name = normalizeName(input.name);
    this.requireGlobal(name);
    const projectPath = normalizeProjectPath(input.projectPath);
    const now = nowIso();
    const existing = this.getExplicitEnablement(name, projectPath);
    const createdAt = existing?.createdAt ?? now;
    const disable = this.db.transaction(() => {
      this.db
        .query(
          `insert into mcp_project_enablements (
            name, project_path, enabled, created_at, updated_at, enabled_at, disabled_at, last_used_at
          ) values (?, ?, 0, ?, ?, null, ?, ?)
          on conflict(name, project_path) do update set
            enabled = 0,
            updated_at = excluded.updated_at,
            disabled_at = excluded.disabled_at`,
        )
        .run(name, projectPath, createdAt, now, now, existing?.lastUsedAt ?? null);
      if (input.stop !== false) {
        this.updateInstance({
          name,
          projectPath,
          lifecycle: "stopped",
          lastStoppedAt: now,
          updatedAt: now,
        });
      }
    });
    disable();
    return this.requireExplicitEnablement(name, projectPath);
  }

  getExplicitEnablement(name: string, projectPath: string): McpProjectEnablement | null {
    const row = this.db
      .query(
        `select name, project_path, enabled, created_at, updated_at, enabled_at, disabled_at, last_used_at
         from mcp_project_enablements
         where name = ? and project_path = ?`,
      )
      .get(normalizeName(name), normalizeProjectPath(projectPath)) as
      | {
          name: string;
          project_path: string;
          enabled: number;
          created_at: string;
          updated_at: string;
          enabled_at: string | null;
          disabled_at: string | null;
          last_used_at: string | null;
        }
      | null;
    return row ? this.mapEnablement(row) : null;
  }

  requireEnabledProject(name: string, projectPath: string): McpProjectEnablement {
    const enablement = this.getExplicitEnablement(name, projectPath);
    if (!enablement?.enabled) {
      throw new Error(`mcp global ${name} is not enabled for project ${normalizeProjectPath(projectPath)}`);
    }
    return enablement;
  }

  listProject(input: { projectPath: string; includeSnapshots?: boolean }): McpEnabledRow[] {
    return this.queryEnabledRows({ projectPath: input.projectPath }).filter((row) => row.enabled === 1);
  }

  listInstalledRows(): McpInstalledRow[] {
    return this.db
      .query(
        `select name,
                title,
                description,
                transport_kind,
                command,
                args_json,
                url,
                headers_json,
                env_json,
                created_at,
                updated_at
         from mcp_globals
         where removed_at is null
         order by name`,
      )
      .all() as McpInstalledRow[];
  }

  query(input: McpQueryInput): McpQueryResult {
    const sql = assertReadOnlyMcpQuerySql(input.sql);
    const queryDb = new Database(":memory:", { strict: true });
    queryDb.exec(`pragma journal_mode = OFF;`);
    queryDb.exec(`pragma synchronous = OFF;`);
    queryDb.exec(`
      create table mcp_installed (
        name text not null,
        title text,
        description text,
        transport_kind text,
        command text,
        args_json text,
        url text,
        headers_json text,
        env_json text,
        created_at text,
        updated_at text
      );
      create table mcp_enabled (
        name text not null,
        project_path text not null,
        enabled integer not null,
        enabled_source text not null,
        title text,
        description text,
        transport_kind text,
        lifecycle text,
        last_error text,
        server_name text,
        server_version text,
        protocol_version text,
        snapshot_at text,
        tools_json text,
        resources_json text,
        prompts_json text,
        snapshot_json text,
        created_at text,
        updated_at text,
        last_used_at text
      );
    `);
    try {
      const insertInstalled = queryDb.query(
        `insert into mcp_installed (
          name, title, description, transport_kind, command, args_json, url, headers_json,
          env_json, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const row of this.listInstalledRows()) {
        insertInstalled.run(
          row.name,
          row.title,
          row.description,
          row.transport_kind,
          row.command,
          row.args_json,
          row.url,
          row.headers_json,
          row.env_json,
          row.created_at,
          row.updated_at,
        );
      }

      const insertEnabled = queryDb.query(
        `insert into mcp_enabled (
          name, project_path, enabled, enabled_source, title, description, transport_kind, lifecycle,
          last_error, server_name, server_version, protocol_version, snapshot_at, tools_json,
          resources_json, prompts_json, snapshot_json, created_at, updated_at, last_used_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const row of this.queryEnabledRows({ projectPath: input.projectPath })) {
        insertEnabled.run(
          row.name,
          row.project_path,
          row.enabled,
          row.enabled_source,
          row.title,
          row.description,
          row.transport_kind,
          row.lifecycle,
          row.last_error,
          row.server_name,
          row.server_version,
          row.protocol_version,
          row.snapshot_at,
          row.tools_json,
          row.resources_json,
          row.prompts_json,
          row.snapshot_json,
          row.created_at,
          row.updated_at,
          row.last_used_at,
        );
      }

      const rows = runJsonRowQuery(queryDb, sql, normalizeQueryParams(input.params));
      return { rows: rows.map(normalizeSqlRow) };
    } finally {
      queryDb.close();
    }
  }

  getInstance(name: string, projectPath: string): McpInstanceRecord | null {
    const row = this.db
      .query(
        `select name, project_path, lifecycle, last_error, created_at, updated_at, last_started_at, last_stopped_at
         from mcp_instances
         where name = ? and project_path = ?`,
      )
      .get(normalizeName(name), normalizeProjectPath(projectPath)) as
      | {
          name: string;
          project_path: string;
          lifecycle: McpLifecycleState;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          last_started_at: string | null;
          last_stopped_at: string | null;
        }
      | null;
    return row ? this.mapInstance(row) : null;
  }

  updateInstance(input: {
    name: string;
    projectPath: string;
    lifecycle: McpLifecycleState;
    lastError?: string | null;
    updatedAt?: string;
    lastStartedAt?: string | null;
    lastStoppedAt?: string | null;
  }): McpInstanceRecord {
    const name = normalizeName(input.name);
    const projectPath = normalizeProjectPath(input.projectPath);
    const now = input.updatedAt ?? nowIso();
    const existing = this.getInstance(name, projectPath);
    const createdAt = existing?.createdAt ?? now;
    this.db
      .query(
        `insert into mcp_instances (
          name, project_path, lifecycle, last_error, created_at, updated_at, last_started_at, last_stopped_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(name, project_path) do update set
          lifecycle = excluded.lifecycle,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at,
          last_started_at = coalesce(excluded.last_started_at, mcp_instances.last_started_at),
          last_stopped_at = coalesce(excluded.last_stopped_at, mcp_instances.last_stopped_at)`,
      )
      .run(
        name,
        projectPath,
        input.lifecycle,
        input.lastError ?? null,
        createdAt,
        now,
        input.lastStartedAt ?? null,
        input.lastStoppedAt ?? null,
      );
    return this.getInstance(name, projectPath) ?? {
      name,
      projectPath,
      lifecycle: input.lifecycle,
      lastError: input.lastError ?? undefined,
      createdAt,
      updatedAt: now,
      lastStartedAt: input.lastStartedAt ?? undefined,
      lastStoppedAt: input.lastStoppedAt ?? undefined,
    };
  }

  saveSnapshot(snapshot: McpCapabilitySnapshot): McpCapabilitySnapshot {
    const name = normalizeName(snapshot.name);
    const projectPath = normalizeProjectPath(snapshot.projectPath);
    this.db
      .query(
        `insert into mcp_snapshots (
          name, project_path, server_name, server_version, protocol_version,
          tools_json, resources_json, prompts_json, snapshot_json, snapshot_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(name, project_path) do update set
          server_name = excluded.server_name,
          server_version = excluded.server_version,
          protocol_version = excluded.protocol_version,
          tools_json = excluded.tools_json,
          resources_json = excluded.resources_json,
          prompts_json = excluded.prompts_json,
          snapshot_json = excluded.snapshot_json,
          snapshot_at = excluded.snapshot_at`,
      )
      .run(
        name,
        projectPath,
        snapshot.serverName ?? null,
        snapshot.serverVersion ?? null,
        snapshot.protocolVersion ?? null,
        toJson(snapshot.tools),
        toJson(snapshot.resources),
        toJson(snapshot.prompts),
        toJson(snapshot.snapshot),
        snapshot.snapshotAt,
      );
    return { ...snapshot, name, projectPath };
  }

  markUsed(name: string, projectPath: string): void {
    this.db
      .query(`update mcp_project_enablements set last_used_at = ?, updated_at = ? where name = ? and project_path = ?`)
      .run(nowIso(), nowIso(), normalizeName(name), normalizeProjectPath(projectPath));
  }

  recordAction(input: {
    action: string;
    name: string;
    projectPath: string;
    toolName?: string;
    autoStart?: boolean;
    autoEnable?: boolean;
    status: "success" | "error";
    inputSummary?: string;
    error?: string;
  }): McpActionRecord {
    const createdAt = nowIso();
    const result = this.db
      .query(
        `insert into mcp_actions (
          action, name, project_path, tool_name, auto_start, auto_enable,
          status, input_summary, error, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.action,
        normalizeName(input.name),
        normalizeProjectPath(input.projectPath),
        input.toolName ?? null,
        input.autoStart === undefined ? null : input.autoStart ? 1 : 0,
        input.autoEnable === undefined ? null : input.autoEnable ? 1 : 0,
        input.status,
        input.inputSummary ?? null,
        input.error ?? null,
        createdAt,
      );
    return {
      actionId: Number(result.lastInsertRowid),
      action: input.action,
      name: normalizeName(input.name),
      projectPath: normalizeProjectPath(input.projectPath),
      toolName: input.toolName,
      autoStart: input.autoStart,
      autoEnable: input.autoEnable,
      status: input.status,
      inputSummary: input.inputSummary,
      error: input.error,
      createdAt,
    };
  }

  private queryEnabledRows(input: { projectPath?: string }): McpEnabledRow[] {
    if (input.projectPath) {
      const projectPath = normalizeProjectPath(input.projectPath);
      return this.db
        .query(
          `select g.name,
                  ? as project_path,
                  coalesce(e.enabled, 0) as enabled,
                  case when e.name is null then 'default' else 'explicit' end as enabled_source,
                  g.title,
                  g.description,
                  g.transport_kind,
                  i.lifecycle,
                  i.last_error,
                  s.server_name,
                  s.server_version,
                  s.protocol_version,
                  s.snapshot_at,
                  s.tools_json,
                  s.resources_json,
                  s.prompts_json,
                  s.snapshot_json,
                  coalesce(e.created_at, g.created_at) as created_at,
                  coalesce(e.updated_at, g.updated_at) as updated_at,
                  e.last_used_at
           from mcp_globals g
           left join mcp_project_enablements e on e.name = g.name and e.project_path = ?
           left join mcp_instances i on i.name = g.name and i.project_path = ?
           left join mcp_snapshots s on s.name = g.name and s.project_path = ?
           where g.removed_at is null
           order by g.name`,
        )
        .all(projectPath, projectPath, projectPath, projectPath) as McpEnabledRow[];
    }
    return this.db
      .query(
        `select e.name,
                e.project_path,
                e.enabled,
                'explicit' as enabled_source,
                g.title,
                g.description,
                g.transport_kind,
                i.lifecycle,
                i.last_error,
                s.server_name,
                s.server_version,
                s.protocol_version,
                s.snapshot_at,
                s.tools_json,
                s.resources_json,
                s.prompts_json,
                s.snapshot_json,
                e.created_at,
                e.updated_at,
                e.last_used_at
         from mcp_project_enablements e
         join mcp_globals g on g.name = e.name and g.removed_at is null
         left join mcp_instances i on i.name = e.name and i.project_path = e.project_path
         left join mcp_snapshots s on s.name = e.name and s.project_path = e.project_path
         order by e.project_path, e.name`,
      )
      .all() as McpEnabledRow[];
  }

  private requireExplicitEnablement(name: string, projectPath: string): McpProjectEnablement {
    const enablement = this.getExplicitEnablement(name, projectPath);
    if (!enablement) {
      throw new Error(`mcp enablement not found: ${name} ${projectPath}`);
    }
    return enablement;
  }

  private mapEnablement(row: {
    name: string;
    project_path: string;
    enabled: number;
    created_at: string;
    updated_at: string;
    enabled_at: string | null;
    disabled_at: string | null;
    last_used_at: string | null;
  }): McpProjectEnablement {
    return {
      name: row.name,
      projectPath: row.project_path,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      enabledAt: row.enabled_at ?? undefined,
      disabledAt: row.disabled_at ?? undefined,
      lastUsedAt: row.last_used_at ?? undefined,
    };
  }

  private mapInstance(row: {
    name: string;
    project_path: string;
    lifecycle: McpLifecycleState;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    last_started_at: string | null;
    last_stopped_at: string | null;
  }): McpInstanceRecord {
    return {
      name: row.name,
      projectPath: row.project_path,
      lifecycle: row.lifecycle,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastStartedAt: row.last_started_at ?? undefined,
      lastStoppedAt: row.last_stopped_at ?? undefined,
    };
  }

  private migrate(): void {
    const versionRow = this.db.query<{ user_version: number }, []>(`pragma user_version`).get();
    const version = Number(versionRow?.user_version ?? 0);
    if (version > MCP_DB_SCHEMA_VERSION) {
      throw new Error(`unsupported mcpSystem sqlite schema version: ${version}`);
    }
    this.db.exec(`
      create table if not exists mcp_globals (
        name text primary key,
        title text,
        description text,
        transport_kind text not null,
        command text,
        args_json text,
        url text,
        headers_json text,
        env_json text,
        transport_env_json text,
        created_at text not null,
        updated_at text not null,
        removed_at text
      );

      create table if not exists mcp_project_enablements (
        name text not null,
        project_path text not null,
        enabled integer not null,
        created_at text not null,
        updated_at text not null,
        enabled_at text,
        disabled_at text,
        last_used_at text,
        primary key (name, project_path)
      );

      create table if not exists mcp_instances (
        name text not null,
        project_path text not null,
        lifecycle text not null,
        last_error text,
        created_at text not null,
        updated_at text not null,
        last_started_at text,
        last_stopped_at text,
        primary key (name, project_path)
      );

      create table if not exists mcp_snapshots (
        name text not null,
        project_path text not null,
        server_name text,
        server_version text,
        protocol_version text,
        tools_json text,
        resources_json text,
        prompts_json text,
        snapshot_json text,
        snapshot_at text not null,
        primary key (name, project_path)
      );

      create table if not exists mcp_actions (
        action_id integer primary key autoincrement,
        action text not null,
        name text not null,
        project_path text not null,
        tool_name text,
        auto_start integer,
        auto_enable integer,
        status text not null,
        input_summary text,
        error text,
        created_at text not null
      );

      create index if not exists idx_mcp_enablements_project on mcp_project_enablements(project_path, enabled, name);
      create index if not exists idx_mcp_instances_lifecycle on mcp_instances(lifecycle, name, project_path);
      create index if not exists idx_mcp_actions_target on mcp_actions(name, project_path, created_at desc);
      pragma user_version = ${MCP_DB_SCHEMA_VERSION};
    `);
  }
}
