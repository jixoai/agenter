# Handoff: add-mcp-system

## Goal

Implement a first-class `mcpSystem` runtime atom for root-workspace MCP usage:

- Global MCP add/remove definitions.
- Exact project enable/disable/list/start/stop/restart/call lifecycle.
- SQL-facing `mcp query` over documented temporary tables.
- SQLite durable fact store under root-workspace runtime authority.
- Official MCP SDK transports for `stdio`, `streamable-http`, and `sse`.
- Built-in `agenter-mcp` skill guidance.
- Real-AI acceptance using stdio sequential-thinking and a reliable SSE MCP server.

The change is OpenSpec `add-mcp-system`, schema `spec-driven`.

## Current Progress

Confirmed from `openspec status --change add-mcp-system --json` and `openspec instructions apply --change add-mcp-system --json`:

- Artifacts are complete: `proposal`, `design`, `specs`, `tasks`.
- Tasks are complete: `77/77`.
- State is `all_done`; OpenSpec says the change is ready to archive after review.

Landed commits visible on current history:

- `3ceb8729 docs(spec): propose mcp system`
- `b03e08cf feat: add mcp system runtime`
- `37e93618 docs(spec): sync mcp system specs`

Durable specs are already synced:

- `openspec/specs/mcp-system/spec.md`
- `openspec/specs/mcp-system-skills/spec.md`
- `SPEC.md` contains the root platform law for mcpSystem.

Implementation evidence is present in:

- `packages/app-server/src/mcp-system/*`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/generated/runtime-skill-catalog.generated.ts`
- `openspec/changes/add-mcp-system/acceptance.md`

## What Worked

The acceptance file records real command evidence:

- `skill info agenter-mcp --json`
- `mcp query --help`
- `mcp add`
- `mcp enable`
- `mcp list`
- `mcp call`
- lifecycle/query/action fact checks

Acceptance targets recorded in `openspec/changes/add-mcp-system/acceptance.md`:

- Stdio: `@modelcontextprotocol/server-sequential-thinking` through `bunx -y`.
- SSE: official `@modelcontextprotocol/server-everything sse` reference/test server through `bunx -y`.

The implemented laws match the user decisions:

- `mcp add/remove` are global-only.
- `mcp enable/disable/list/start/stop/restart/call` are project-facing.
- `autoStart` defaults to `true`; `autoEnable` defaults to `false`.
- `disable.stop` defaults to `true`; `remove.stop` defaults to `false`.
- Query always returns JSON rows.
- Query exposes `mcp_installed` and `mcp_enabled`.
- No separate secret-reference layer; stdio env comes from root-workspace runtime env plus literal overlays.

## What Didn't Work

- No current implementation blocker is recorded in the latest OpenSpec status.
- The change is complete but not archived.
- The acceptance transcript includes temporary paths from the original verification environment; treat them as evidence paths, not reusable test fixtures.

## Next Steps

For the main-branch developer:

- Review `add-mcp-system` on `main`.
- Re-run focused gates if needed before archive.
- Archive `add-mcp-system` once accepted.
- Do not redesign the public MCP CLI during archive; the current user-approved public law is already captured in specs and tasks.
