---
name: agenter-mcp
description: Install, enable, query, call, and recover MCP servers through the root runtime CLI. Use this when a task mentions MCP servers, MCP tools, stdio, Streamable HTTP, SSE, or project MCP availability.
---

# agenter-mcp

Use this skill when you need to make MCP servers available to one exact project or inspect what MCPs are installed, enabled, running, or callable.

Quick start:

1. Run `mcp --help` or `mcp <command> --help` before guessing an argument shape.
2. Use `mcp add` once to create or update a global MCP config. This never enables a project and never starts a server.
3. Use `mcp enable` with an explicit absolute `projectPath` before a project can call that MCP.
4. Use `mcp list` with `projectPath` to see enabled MCPs for that exact project, their lifecycle, and the latest project-local snapshot when one exists.
5. Use `mcp query` when you need a cross-cutting answer. Read `mcp query --help`, then write SQL against `mcp_installed` and `mcp_enabled`.
6. Use `mcp call` for the normal path. Defaults are `autoStart: true` and `autoEnable: false`.
7. Use `mcp stop` or `mcp restart` for resource release and recovery when a server is unhealthy.

Key laws:

- `mcp` is a root-workspace runtime CLI surface. It is not a direct model tool.
- Public scope words are `global` and `project`.
- `mcp add` and `mcp remove` are global-only. They manage reusable MCP configs by `name`.
- `mcp enable`, `mcp disable`, `mcp list`, `mcp start`, `mcp stop`, `mcp restart`, and `mcp call` are project-facing and require explicit `projectPath`.
- Every project path is exact after normalization. Parent and child directories do not inherit enablement, running instances, or snapshots.
- A newly added global is disabled in every project by default.
- `mcp list` shows only enabled MCPs for the exact project. Disabled globals stay out of the list.
- If an enabled MCP is stopped, `mcp list` may still show the latest successful project-local snapshot. If it has never started successfully, snapshot fields are absent.
- Snapshots are project-local. A snapshot discovered under one `projectPath` is never shared with another project path.
- `mcp query` always returns JSON rows. There is no text or table output mode.
- `mcp query` exposes two temporary tables: `mcp_installed` for globals created by `mcp add`, and `mcp_enabled` for project enablement plus project-local lifecycle and snapshot projections.
- When `projectPath` is passed to `mcp query`, `mcp_enabled` projects every installed global for that exact project and marks missing enablement as `enabled=0` and `enabled_source='default'`.
- Without `projectPath`, `mcp_enabled` contains only explicit project enablement rows and does not invent default-disabled project rows.
- Put `LIMIT` in the SQL when you need a bounded result; `mcp query` does not provide a separate limit option.
- Supported transports are `stdio`, `streamable-http`, and `sse`, all through the official MCP SDK.
- Stdio environment comes from root-workspace runtime env, overlaid by global `env`, then transport `env`. This MCP system does not add a separate secret-reference layer.
- Remote headers are literal config values in the first implementation.
- `mcp call` can auto-start an enabled stopped server by default, but it does not auto-enable a disabled project unless `autoEnable: true` is explicit.
- `mcp disable` defaults to `stop: true`.
- `mcp remove` defaults to `stop: false`. If running project instances block removal, inspect the returned project paths; only retry with `stop: true` when you intentionally want to stop those instances and remove the global.
- Use `mcp restart` after an MCP server hangs, changes its command behavior, or returns suspicious capability state.

Common commands:

```text
mcp add
stdin: {"name":"thinking","title":"Sequential Thinking","transport":{"kind":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-sequential-thinking"]}}

mcp enable
stdin: {"name":"thinking","projectPath":"/repo/app"}

mcp list
stdin: {"projectPath":"/repo/app"}

mcp query
stdin: {"projectPath":"/repo/app","sql":"select name, enabled, enabled_source, lifecycle, tools_json from mcp_enabled order by name"}

mcp call
stdin: {"name":"thinking","projectPath":"/repo/app","toolName":"sequentialthinking","arguments":{"thought":"Break down the next implementation step.","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}}
```

Recovery patterns:

- Missing global: run `mcp query` against `mcp_installed`, then `mcp add` if the config is absent.
- Disabled project: run `mcp enable` for the exact `projectPath`, then call again.
- Stopped enabled project: default `mcp call` starts it automatically; pass `autoStart:false` only when you require a pre-started instance.
- Bad or stale snapshot: run `mcp restart`, then `mcp list` or `mcp query` to inspect the new project-local snapshot.
- Remove blocked by running projects: first read the blocked project paths, then retry `mcp remove` with `stop:true` only when those projects can be stopped.
