## Why

Agenter needs a first-class MCP runtime system so avatars can use external MCP servers through the same root-workspace CLI/API law as message, terminal, workspace, attention, and skill. Without a system-owned global registry and project-scoped enablement/lifecycle, MCP usage would either become ad-hoc shell glue or leak provider-specific MCP catalogs into the model surface.

## What Changes

- Add an `mcpSystem` module that owns MCP global configs, project enablement state, project-scoped process lifecycle, protocol transport adapters, and latest project-local capability snapshots.
- Persist mcpSystem state in an avatar-private SQLite database under the root-workspace runtime authority, using Bun's built-in SQLite support.
- Support stdio, Streamable HTTP, and SSE in the first implementation through the official MCP TypeScript SDK client transports.
- Resolve MCP stdio env from root-workspace runtime env plus literal global/transport overlays; this change does not introduce a separate secret-reference system.
- Expose a root-workspace `mcp` CLI namespace backed by the shared runtime descriptor registry and loopback-local API.
- Use a two-level command model:
  - `mcp add/remove` only manages global MCP definitions.
  - `mcp enable/disable/list/start/stop/restart/call` operates on an exact project path and global MCP name.
- Make all global MCPs disabled by default in every project. Project queries can still report a global MCP as `disabled` even when no project enablement record exists.
- Make `mcp list` a project-facing command that lists currently enabled MCPs for the exact project, including global description, lifecycle state, and latest project-local startup snapshot when available.
- Make `mcp call` require the global MCP to be enabled in the project by default. It may auto-start a stopped instance with `autoStart: true` and may auto-enable with `autoEnable: true` only when the caller explicitly opts in.
- Make `mcp remove` global-only with `stop?: boolean` defaulting to `false`; running project instances block removal unless `stop: true` is explicitly provided.
- Replace enumerated query modes with a read-only SQL query surface. `mcp query --help` exposes two temporary table schemas and examples; callers provide SQL that runs against `mcp_installed` and `mcp_enabled`, and execution always returns JSON rows.
- Add `mcp-system-skills` as built-in skill guidance that teaches AI how to use `mcp <command> --help`, enable/list/call workflows, SQL query, auto-start behavior, and recovery commands.
- Keep MCP tools behind runtime-local CLI/API. This change does not inject MCP server tools directly into the provider model tool list.
- Require final real-AI acceptance: an AI must install, enable, query, list, call, and recover MCP usage through the root-workspace `mcp` CLI and skill/help guidance, using a real stdio server and a real SSE server fixture.

## Capabilities

### New Capabilities

- `mcp-system`: SQLite-backed global MCP registry, project enablement table, SQL query surface, transport adapter lifecycle, project-local snapshots, and invocation.
- `mcp-system-skills`: built-in skill guidance for AI-facing MCP usage, SQL query help discovery, and troubleshooting.

### Modified Capabilities

- `runtime-json-tool-descriptor-surface`: add the `mcp` namespace to descriptor-backed runtime-local CLI/API, schema, route, help, and examples.
- `runtime-skills-cli-surface`: expose `mcp` inside root-workspace shell and progressive skill discovery without expanding the direct model tool list.

## Impact

- Affected code: `packages/app-server` runtime-local API, runtime CLI, runtime descriptor registry, root-workspace shell command list, runtime skill catalog generation, and tests.
- New package/module likely needed: `packages/mcp-system` or an app-server submodule that can later be extracted, with strongly typed global config, project enablement, instance, transport, snapshot, and SQL query contracts.
- New dependency likely needed: official MCP TypeScript SDK for client transports and protocol calls.
- Persistence impact: avatar-private runtime root needs `mcp-system/mcp.sqlite` or equivalent SQLite storage for global configs, project enablement records, live instance records, snapshots, and action facts.
- Verification impact: BDD integration tests for global add/remove, project enable/disable/list, SQL query table schemas/help, query JSON rows, query read-only enforcement, project lock, call auto-start, call auto-enable opt-in, stop/restart, help generation, stdio plus Streamable HTTP plus SSE transport adapters, and final real-AI walkthroughs against `@modelcontextprotocol/server-sequential-thinking` for stdio plus an SDK-backed SSE fixture.
