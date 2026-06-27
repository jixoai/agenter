## 1. Research And Contract Closure

- [x] 1.1 Confirm project path scope law with user: explicit absolute path, no parent/child inheritance.
- [x] 1.2 Confirm global config storage law with user: avatar-private root store for this change.
- [x] 1.3 Confirm first implementation includes `mcp call`.
- [x] 1.4 Confirm simplified single-word CLI surface with user.
- [x] 1.5 Confirm public terminology with user: use `project` and `global` as the public scope words.
- [x] 1.6 Correct model boundary with user: `add/remove` are global-only.
- [x] 1.7 Correct project controls with user: `enable/disable/list/start/stop/restart/call` are project-facing.
- [x] 1.8 Confirm call defaults with user: `autoStart: true`, `autoEnable: false`.
- [x] 1.9 Confirm `mcp disable` default with user: `stop: true`.
- [x] 1.10 Confirm `mcp remove` default with user: `stop: false`.
- [x] 1.11 Confirm query law with user: SQL-facing `mcp query` over documented temporary table schema.
- [x] 1.12 Confirm SQL query uses two tables with user: installed globals and enabled projects.
- [x] 1.13 Confirm `mcp query` output with user: execution always returns JSON rows.
- [x] 1.14 Confirm transport scope with user: stdio, Streamable HTTP, and SSE are all implemented in the first slice through the official MCP SDK.
- [x] 1.15 Confirm env law with user: no separate secret references; use root-workspace runtime env plus literal global/transport overlays.
- [x] 1.16 Confirm final acceptance includes real AI testing with `@modelcontextprotocol/server-sequential-thinking` for stdio and a reviewed reliable SSE MCP target.
- [x] 1.17 Validate final OpenSpec artifacts with `openspec validate add-mcp-system --strict`.

## 2. MCP System Model

- [x] 2.1 Add mcpSystem types for global configs, project enablement, instance keys, lifecycle status, project-local discovery snapshots, and action facts.
- [x] 2.2 Add durable SQLite database under avatar-private runtime root.
- [x] 2.3 Add durable `mcp_globals` table for global configs.
- [x] 2.4 Add durable `mcp_project_enablements` table for exact project/global enablement records.
- [x] 2.5 Model default disabled status as a query projection from global existence plus missing project enablement.
- [x] 2.6 Add durable `mcp_instances`, `mcp_snapshots`, and `mcp_actions` tables.
- [x] 2.7 Add per-project/global in-memory lifecycle lock keyed by `(name, projectPath)`.

## 3. MCP Protocol Adapters

- [x] 3.1 Add official MCP SDK dependency in the owning package.
- [x] 3.2 Implement stdio client transport adapter with cwd and root-workspace runtime env plus literal env overlays.
- [x] 3.3 Implement Streamable HTTP client transport adapter through the official MCP SDK.
- [x] 3.4 Implement SSE client transport adapter through the official MCP SDK.
- [x] 3.5 On successful initialization, discover server info, tools, resources, and prompts where supported.
- [x] 3.6 Persist discovery snapshots under the exact project/global pair and never share snapshots across projects.

## 4. Runtime CLI/API Integration

- [x] 4.1 Extend `RuntimeLocalApiHandlers` with mcpSystem handler methods.
- [x] 4.2 Add `mcp` to `RuntimeToolNamespace`.
- [x] 4.3 Add descriptor-backed global `mcp add/remove` commands, including `remove.stop` default `false`.
- [x] 4.4 Add descriptor-backed project `mcp enable/disable/list` commands, including `disable.stop` default `true`.
- [x] 4.5 Add descriptor-backed SQL `mcp query` command.
- [x] 4.6 Add `mcp query --help` schema output for the temporary `mcp_installed` and `mcp_enabled` tables and query examples.
- [x] 4.7 Enforce read-only SQL for `mcp query` and reject mutation, attachment, pragma, vacuum, and multi-statement payloads.
- [x] 4.8 Ensure `mcp query` execution returns JSON row arrays only.
- [x] 4.9 Add descriptor-backed project `mcp start/stop/restart` commands.
- [x] 4.10 Add descriptor-backed project `mcp call` command with `autoStart` and `autoEnable`.
- [x] 4.11 Keep internal ensure private to mcpSystem rather than exposing an extra AI-facing command.
- [x] 4.12 Add `mcp` to root-workspace shell command creation and command discovery.
- [x] 4.13 Ensure all `mcp --help` and `mcp <subcommand> --help` output is generated locally from descriptors.

## 5. Built-In Skill

- [x] 5.1 Add built-in `agenter-mcp` skill beside the owning system package.
- [x] 5.2 Teach global add/remove, project enable/disable/list, SQL query, JSON row output, supported transports, env source law, query help/schema discovery, explicit project path, default-disabled behavior, `autoStart`, `autoEnable`, remove/disable `stop` defaults, remove two-step confirmation, lifecycle recovery, project-local snapshots, and help-first usage.
- [x] 5.3 Regenerate runtime skill catalog.
- [x] 5.4 Add tests proving `skill list/info` exposes the MCP skill.

## 6. Verification

- [x] 6.1 Add BDD tests for global add not enabling or starting any project.
- [x] 6.2 Add BDD tests for global remove defaulting `stop:false` and rejecting running project instances.
- [x] 6.3 Add BDD tests for global remove with `stop:true` stopping project instances and revoking active project enablement.
- [x] 6.4 Add BDD tests for SQL query showing a newly added global as disabled by default when `projectPath` is passed.
- [x] 6.5 Add BDD tests for SQL query without `projectPath` not inventing default-disabled project rows.
- [x] 6.6 Add BDD tests for project enable/disable without live startup.
- [x] 6.7 Add BDD tests for disable defaulting `stop:true` and honoring `stop:false`.
- [x] 6.8 Add BDD tests for project list returning only enabled MCPs with global descriptions and optional snapshots.
- [x] 6.9 Add BDD tests for exact project/session reuse and no parent/child inheritance.
- [x] 6.10 Add BDD tests for `mcp call` auto-starting enabled stopped MCPs by default.
- [x] 6.11 Add BDD tests that `mcp call` rejects disabled MCPs by default.
- [x] 6.12 Add BDD tests that `mcp call` with `autoEnable: true` enables before use.
- [x] 6.13 Add BDD tests that `mcp call` with `autoStart: false` rejects stopped instances.
- [x] 6.14 Add BDD tests for start/stop/restart lifecycle.
- [x] 6.15 Add BDD tests for `mcp query --help` exposing the two temporary table schemas and examples.
- [x] 6.16 Add BDD tests for read-only SQL enforcement.
- [x] 6.17 Add BDD tests for project-local snapshot JSON search through `mcp_enabled`.
- [x] 6.18 Add BDD tests that `mcp query` returns JSON rows only.
- [x] 6.19 Add BDD tests for root-workspace runtime env plus literal env overlays and no secret-reference requirement.
- [x] 6.20 Add BDD tests that runtime direct model tools remain `workspace_list`, `root_bash`, and `workspace_bash`.
- [x] 6.21 Add integration fixture for stdio MCP server discovery.
- [x] 6.22 Add integration fixture for Streamable HTTP MCP transport discovery.
- [x] 6.23 Add integration fixture for SSE MCP transport discovery.
- [x] 6.24 Add final real-AI walkthrough for stdio using `@modelcontextprotocol/server-sequential-thinking`: add, enable, query, list, call, inspect action facts, stop/restart recovery.
- [x] 6.25 Add final real-AI walkthrough for SSE using a reviewed reliable SSE MCP server fixture, preferably the official TypeScript SDK `simpleSseServer` example or an equivalent local fixture derived from the SDK.
- [x] 6.26 Record real-AI acceptance evidence with command transcript, expected/actual result, and project path used.
- [x] 6.27 Run targeted tests, `bun run typecheck`, and the relevant package test suites.

## 7. Durable Spec Sync Before Archive

- [x] 7.1 Update root `SPEC.md` with the mcpSystem platform law after implementation.
- [x] 7.2 Update `packages/app-server/SPEC.md` or new package `SPEC.md` with durable MCP responsibilities.
- [x] 7.3 Sync finalized capability specs into `openspec/specs/*` before archive.
