# Design

## Context

Agenter already has the platform law needed for MCP if we keep the boundary strict:

- model direct tools stay minimal: `workspace_list`, `root_bash`, `workspace_bash`
- system-specific operations are discovered through runtime-local CLI/API
- root-workspace carries avatar-private runtime CLI/env
- built-in system skills teach usage style while durable truth stays in the owning system
- descriptors are the single source for route, schema, help, examples, and dispatch

The new MCP need is not "add another provider feature". It is a new runtime system that manages external MCP server clients on behalf of an avatar.

## Goals

- Add `mcpSystem` as an independent runtime system atom.
- Support reusable MCP global configs.
- Support project-local enablement and project-local process lifecycle.
- Support stdio, Streamable HTTP, and SSE through official MCP SDK client transports.
- Use SQLite as the durable store and query substrate.
- Make add, enable, list, SQL query, and call the primary user/AI workflows.
- Let AI use SQL for complex inspection instead of forcing every query shape into custom CLI flags.
- Auto-start project instances on call by default while preserving manual start/stop/restart controls.
- Expose global and project-scoped introspection without expanding provider direct tools.
- Provide built-in AI guidance through `mcp-system-skills`.

## Non-Goals

- Do not implement workspace-mounted system ownership from `settings.local.json`; that belongs to `workspace-mounted-systems-and-attention-contexts`.
- Do not let mounted public workspaces inherit root-workspace MCP CLI/env.
- Do not map MCP server tools directly into model provider tools.
- Do not create a second global MCP registry in skills, prompts, or provider metadata.
- Do not add project-path inheritance; exact project path scope is part of the durable law.
- Do not allow arbitrary mutating SQL through `mcp query`.

## Core Model

### Global Config

A global config is durable configuration, similar to Claude/Codex/Gemini named MCP server entries. It is the only thing managed by `mcp add` and `mcp remove`. The public key is `name`; internal ids may exist but are not the AI-facing selector.

```ts
interface McpGlobalConfig {
  name: string;
  title?: string;
  description?: string;
  transport: McpTransportConfig;
  env?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
```

Transport configs should be discriminated:

```ts
type McpTransportConfig =
  | { kind: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { kind: "streamable-http"; url: string; headers?: Record<string, string> }
  | { kind: "sse"; url: string; headers?: Record<string, string> };
```

The first implementation must wire these transports through the official MCP TypeScript SDK client transport APIs instead of hand-rolling protocol framing. Streamable HTTP is the preferred modern remote transport, while SSE remains a fully supported remote transport for existing MCP server configs.

Environment law:

- stdio process env resolves from root-workspace runtime env plus global config `env` and transport-level `env`, with later overlays winning.
- remote transport headers resolve from configured literal header values and the root-workspace runtime env when the implementation explicitly supports env interpolation.
- this change does not add a separate secret-reference system; avatar-private root-workspace runtime env is the credential authority for the first implementation.

Global configs do not imply project availability. Every global MCP is disabled in every project until explicitly enabled.

### Project Enablement

Project enablement is the durable fact that an exact project path may use a named global MCP. It is controlled by `mcp enable` and `mcp disable`, not by `mcp add/remove`.

```ts
interface McpProjectEnablement {
  name: string;
  projectPath: string; // normalized absolute path for the exact project root
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  enabledAt?: string;
  disabledAt?: string;
  lastUsedAt?: string;
}
```

Uniqueness law:

```ts
type McpProjectKey = {
  name: string;
  projectPath: string;
};
```

Default law:

- `mcp add` creates or updates only the global config.
- Project status for a newly added global is `disabled` everywhere by default.
- A project-scoped SQL query can project a global MCP as `enabled = 0` even if no project enablement row exists.
- `mcp list` does not show disabled globals; it lists enabled MCPs for the project.

This is the key design that makes Agenter feel like traditional MCP clients while preserving project safety: global installation is cheap and inert, and project availability is explicit.

### Live Session

A live session is a process/client lifecycle object keyed by the project/global pair:

```ts
type McpInstanceKey = {
  name: string;
  projectPath: string;
};
```

The instance owns:

- current lifecycle status: `starting | running | stopped | failed`
- transport resources: child process, HTTP session, or SSE session
- last startup error
- latest successful discovery snapshot
- timestamps and last action source

Project path scope is exact. `/repo` and `/repo/app` are different project scopes. `start`, `stop`, and `restart` manage this project-local process state and require an enabled project/global pair.

### Capability Snapshot

After successful MCP initialization, mcpSystem discovers and stores a project-local snapshot:

- server info
- protocol/capability metadata
- tools list
- resources list, if supported
- prompts list, if supported
- discovery timestamp
- instance key that produced the snapshot

This snapshot is a projection for overview and help. It must not rewrite the global config and must not be shared across projects. If global MCP `fs` has snapshots under `/repo/a` and `/repo/b`, a query for `/repo/a` can only use `/repo/a`'s snapshot.

## Command Surface

### Add And Remove Global

`mcp add` and `mcp remove` are global-only:

```ts
type McpAddInput = {
  name: string;
  transport: McpTransportConfig;
  title?: string;
  description?: string;
  env?: Record<string, string>;
};

type McpRemoveInput = {
  name: string;
  stop?: boolean; // default false
};
```

`mcp add` records a named MCP server config. It never enables any project and never starts a server.

`mcp remove` removes a named global MCP config. Default `stop: false` means running project instances block removal. When `stop: true`, mcpSystem first stops all running project instances for that global, then removes the global config and revokes associated project enablement records. Query/action history may keep historical facts, but the removed global must no longer appear as an active global config.

### Enable And Disable Project

Project availability is controlled explicitly:

```ts
type McpEnableInput = {
  name: string;
  projectPath: string;
};

type McpDisableInput = {
  name: string;
  projectPath: string;
  stop?: boolean; // default true
};
```

`enable` requires the global config to exist. It creates or updates the project enablement record with `enabled: true`.

`disable` marks the project/global pair disabled. Default `stop: true` means a running project instance is stopped as part of disabling. A caller may pass `stop: false` only when it intentionally wants to revoke future availability without immediately releasing the current process.

### List Project

`mcp list` is project-facing:

```ts
type McpListInput = {
  projectPath: string;
  includeSnapshots?: boolean; // recommended default: true
};
```

It lists only enabled MCPs for the exact project path. Each row should include:

- global name
- global title/description
- enabled state
- lifecycle state
- latest project-local snapshot if available

If an enabled MCP has never started successfully, snapshot fields are absent. If it is enabled but stopped, the latest successful snapshot is still shown as stale project-local overview.

### Start Stop Restart

Lifecycle commands are project process management:

```ts
type McpLifecycleInput = {
  name: string;
  projectPath: string;
};
```

`start` requires the global MCP to be enabled for the exact project. It starts the project/global live session and records a new snapshot after successful discovery.

`stop` closes the client and transport resources for the exact project/global pair. For stdio this means terminating the child process. For remote transports this means closing the client/session resources that the SDK exposes.

`restart` is `stop` followed by `start`.

### Call

Calling requires:

- `projectPath`
- `name`
- the target MCP tool/capability name
- arguments

```ts
type McpCallInput = {
  name: string;
  projectPath: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  autoStart?: boolean; // default true
  autoEnable?: boolean; // default false
};
```

Call behavior:

1. If the global config is missing, reject.
2. If the project/global pair is disabled:
   - `autoEnable: false` rejects with an enable-oriented error.
   - `autoEnable: true` enables the project/global pair before continuing.
3. If no live session is running:
   - `autoStart: true` starts it.
   - `autoStart: false` rejects with a start-oriented error.
4. If startup succeeds, invoke the tool.
5. Return either the tool result or the startup/tool failure as one command result.

The normal AI path should keep the defaults: `autoStart: true`, `autoEnable: false`. This lets AI use already-enabled MCPs naturally while preventing accidental project enablement.

## SQL Query Surface

`mcp query` is a read-only SQL surface over mcpSystem facts. This is intentionally more powerful than enumerated query modes: AI can inspect the table schema from help, write SQL, and answer complex questions without the CLI author predefining every query path.

```ts
type McpQueryInput = {
  sql: string;
  params?: Record<string, string | number | boolean | null>;
  projectPath?: string;
};
```

`mcp query` always returns JSON rows. The descriptor may render help text for humans, but query execution itself does not have table/text output modes. This keeps the command result stable for AI callers and lets downstream code inspect exact row values.

Query callers put `LIMIT` directly in SQL when they need bounded results. `mcp query` intentionally has no separate `limit` field, so SQL remains the single query language.

`mcp query --help` MUST show:

- accepted payload shape
- JSON row output contract
- read-only SQL restrictions
- temporary table schemas
- how `projectPath` changes the table projection
- examples for global inventory, project enabled list, default-disabled check, running instances, and snapshot JSON search

### Query Execution Law

The implementation should use Bun's built-in SQLite support for persistence and read-only query execution. Each query runs against the mcpSystem SQLite database in a read-only transaction. Before executing caller SQL, mcpSystem creates two temporary query tables: `mcp_installed` and `mcp_enabled`.

Only read-only statements are allowed. First implementation should accept `SELECT` and `WITH ... SELECT`, optionally `EXPLAIN QUERY PLAN` for debugging. It should reject mutation or escape statements such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, and multi-statement payloads.

### Temporary Table Schemas

The query surface exposes two temporary tables. They directly mirror the product concepts:

- `mcp_installed`: globals created by `mcp add`
- `mcp_enabled`: project enablement created by `mcp enable`, plus project-local runtime/snapshot projection

`mcp_installed`:

```sql
CREATE TEMP TABLE mcp_installed (
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  transport_kind TEXT,
  command TEXT,
  args_json TEXT,
  url TEXT,
  headers_json TEXT,
  env_json TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

`mcp_enabled`:

```sql
CREATE TEMP TABLE mcp_enabled (
  name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  enabled INTEGER NOT NULL,            -- 1 enabled, 0 disabled
  enabled_source TEXT NOT NULL,        -- 'explicit' | 'default'
  title TEXT,
  description TEXT,
  transport_kind TEXT,
  lifecycle TEXT,                      -- 'running' | 'stopped' | 'failed' | 'starting'
  last_error TEXT,
  server_name TEXT,
  server_version TEXT,
  protocol_version TEXT,
  snapshot_at TEXT,
  tools_json TEXT,
  resources_json TEXT,
  prompts_json TEXT,
  snapshot_json TEXT,
  created_at TEXT,
  updated_at TEXT,
  last_used_at TEXT
);
```

When `projectPath` is passed to `mcp query`, `mcp_enabled` MUST include one projected row for every active global config in that project. Rows projected from missing enablement have `enabled = 0` and `enabled_source = 'default'`. This is how `mcp add` followed by a project query can return disabled state even without an explicit project enablement row.

When `projectPath` is omitted, `mcp_enabled` includes only explicit project enablement rows plus live/snapshot facts tied to known project paths. It does not invent default-disabled rows for unknown project paths.

Capabilities are not a third table. The latest project-local discovery result is exposed through `tools_json`, `resources_json`, `prompts_json`, and `snapshot_json` on `mcp_enabled`. AI can use SQLite JSON functions where available or fetch the row and inspect JSON in code.

### SQL Examples

Project enabled MCPs, equivalent to `mcp list` but queryable:

```sql
SELECT name, title, description, lifecycle, snapshot_at
FROM mcp_enabled
WHERE project_path = :projectPath AND enabled = 1
ORDER BY name;
```

Check whether a global is enabled in the current project, including default disabled:

```sql
SELECT name, enabled, enabled_source, lifecycle, snapshot_at
FROM mcp_enabled
WHERE name = :name;
```

Find all running project instances:

```sql
SELECT name, project_path, lifecycle, last_used_at
FROM mcp_enabled
WHERE lifecycle = 'running'
ORDER BY project_path, name;
```

Find project rows with a tool in the latest snapshot:

```sql
SELECT name, project_path, tools_json, snapshot_at
FROM mcp_enabled
WHERE enabled = 1
  AND tools_json LIKE '%read_file%';
```

Tool/resource/prompt JSON must always be interpreted as snapshot evidence, not global truth. A tool listed in `tools_json` only proves that the exact project/global pair had that tool in its own latest snapshot.

## Lifecycle

`start` / internal ensure:

1. normalize and validate `projectPath`
2. load the global config by `name`
3. resolve project enablement from `(name, projectPath)`
4. reject if the project/global pair is not enabled
5. acquire per-key lock
6. if existing running instance is healthy, return it
7. otherwise create transport adapter
8. initialize MCP client session
9. discover capabilities
10. persist latest project-local snapshot
11. return instance view

`call` applies the `autoEnable` and `autoStart` gates before invoking the MCP tool.

## Persistence

Persist mcpSystem under avatar-private runtime root:

```text
<rootWorkspace>/mcp-system/mcp.sqlite
```

Suggested durable SQLite tables:

- `mcp_globals`
- `mcp_project_enablements`
- `mcp_instances`
- `mcp_snapshots`
- `mcp_actions`

The exposed `mcp_installed` and `mcp_enabled` query tables are temporary projections over these durable tables. They are not themselves the durable source of truth.

This keeps MCP truth tied to avatar-private runtime authority and avoids pretending mounted public workspaces own MCP credentials. A later workspace-mounted-system change can define workspace-local MCP declarations.

## Concurrency

Use one in-memory lock per `(name, projectPath)` to prevent duplicate starts. All lifecycle mutations for that project/global key run under the same lock.

The durable record should tolerate process restart:

- global configs survive
- project enablement records survive
- running records from a previous process are recovered as `stopped` or `unknown` unless a reusable external remote session can be health-checked
- latest project-local snapshots remain available as stale projection
- next allowed call can auto-start a fresh live instance

SQLite is the durable fact store; in-memory lifecycle locks only protect process-local startup races.

## Attention And Effects

MCP does not automatically create provider tools or hidden prompt content. MCP actions are explicit runtime CLI/API actions. Tool calls should be traceable through existing root_bash/tool trace and, when needed, through `mcp_actions`.

If later mcpSystem needs to publish reminders, it should do so through normal attention commits/items and a system skill that teaches how to interpret them.

## Skill Design

Add package-owned built-in skill:

```text
packages/mcp-system/skills/mcp/SKILL.md
```

or if implemented inside app-server first:

```text
packages/app-server/skills/mcp/SKILL.md
```

Preferred long-term direction is package-owned skill beside the system module.

The skill should explain:

- what global configs are
- why `add/remove` are global-only
- supported transports: `stdio`, `streamable-http`, and `sse`
- environment resolution from root-workspace runtime env plus literal global/transport overlays
- what project enablement means
- why global MCPs are disabled by default in every project
- why every project command passes `projectPath`
- exact project path matching
- how to use `list` for enabled project MCPs
- how to use `query --help` to inspect the SQL table schemas
- how to write read-only SQL against `mcp_installed` and `mcp_enabled`
- that `query` returns JSON rows only
- `call` defaults: `autoStart: true`, `autoEnable: false`
- `remove` default: `stop: false`
- `disable` default: `stop: true`
- stop/restart recovery
- how project list/query uses latest successful project-local snapshots
- JSON stdin as the default structured payload path

## Alternatives

### Provider-native MCP tool injection

Some providers may expose native MCP catalog support. Treating that as the primary path would fragment behavior by provider and break the current minimal model tool law. Reject for this change.

Future option: add an export adapter that projects mcpSystem-managed globals/snapshots into providers with native MCP support while mcpSystem remains the authority.

### Enumerated query modes

The previous draft exposed `global`, `project`, `state`, and `capability` query modes. This was simpler to validate but weaker for AI agents because every new question needed a new mode or flag. Reject in favor of a read-only SQL surface over a documented temporary table.

### Workspace-local MCP declarations first

This aligns with the future `workspace-mounted-systems-and-attention-contexts` direction, but it expands the problem into workspace secret ownership and mount/unmount attention semantics. Reject for this change; keep current scope root-workspace owned.

### One process per global MCP

This ignores the user's project requirement and would make tools that depend on cwd/project roots ambiguous. Reject.

## Closed Decisions From Review

- `mcp query` execution always returns JSON rows; table/text modes are not part of the command contract.
- stdio, Streamable HTTP, and SSE are all first-implementation transports through the official MCP TypeScript SDK.
- mcpSystem does not introduce secret references in this change. Credentials come from root-workspace runtime env and configured literal env/header overlays.
