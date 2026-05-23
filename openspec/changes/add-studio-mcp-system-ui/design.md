## Context

`mcpSystem` is already a runtime-owned system atom. It stores reusable global MCP configs, exact-project enablement, project-scoped live instances, discovery snapshots, action facts, SQL query projections, and MCP tool calls under Avatar runtime authority. The current operator gap is that Studio has no first-class surface for this system, while the only complete control surface is the root-workspace `mcp` CLI/API.

The closest existing Studio product is Skills: both are catalogs of runtime abilities, both need list-detail inspection, and both should stay inside Studio workbench navigation. MCP is simpler than Skills in UI shape because there is no filesystem tree or file preview. The important MCP-specific interaction is the two-layer model: installed globals are inert, then exact projects enable and run them.

## Goals / Non-Goals

**Goals:**

- Add `/mcp` as an independent Studio workbench destination.
- Let an operator inspect and manage MCP globals, project enablement, project-local lifecycle, latest snapshots, latest errors, and action facts.
- Keep the UI simpler than Skills: list, project filter, detail pane, and focused dialogs rather than tree/file-preview navigation.
- Add a typed client runtime-store MCP facade so Studio consumes daemon/client-sdk contracts.
- Preserve all existing MCP laws: global configs are separate from project enablement, project paths are exact, snapshots are project-local, lifecycle is project-scoped, disabled globals are inert, and MCP tools stay behind runtime-local APIs.

**Non-Goals:**

- Do not couple MCP UI to cli-shell.
- Do not expose MCP server tools as provider direct tools.
- Do not add project path inheritance or workspace-scoped implicit enablement.
- Do not add a separate Studio database for MCP state.
- Do not add a secret-reference system; credentials still belong to the runtime/root-workspace environment law.
- Do not make Studio import `@agenter/app-server` or `mcp-system` internals.

## Decisions

### Decision 1: `/mcp` is a Studio workbench, not a settings subpage

MCP is a runtime system with live instances and action history, not only static configuration. It belongs beside Skills, Terminals, Workspaces, Messages, and Avatars in the app shell. The sidebar adds one `MCP` item and routes to `/mcp`.

Alternative considered: put MCP under Settings or Skills. That hides lifecycle and exact-project enablement, and it makes MCP look like a file catalog or preference group instead of a runtime system.

### Decision 2: UI story starts from an AvatarRuntime scope

The operator first needs a runtime/Avatar authority. The workbench therefore has a runtime scope selector derived from running Avatar sessions or a persisted last-used runtime. All MCP reads and writes are routed through that runtime's MCP surface.

This keeps the MCP DB ownership truthful: Studio does not own MCP facts; it projects one runtime's `mcpSystem` facts.

### Decision 3: Main layout is project-filtered list-detail

The primary screen is:

```text
MCP workbench
Toolbar: [Runtime] [Project path] [Search] [Add server] [Refresh]

Left list:
  name / transport / enabled-for-project / lifecycle / tool count / last error marker

Detail:
  Summary
  Global config
  Project enablement toggle
  Start / Stop / Restart
  Tools / Resources / Prompts snapshot
  Recent actions / latest error
  Optional test tool call
```

When no project path is selected, the list shows global configs only. When a project path is selected, the list uses the same projection law as `mcp query(projectPath)`: installed globals may appear as disabled defaults, and enabled rows show lifecycle plus project-local snapshots.

### Decision 4: Mutations stay command-like and explicit

The UI uses typed runtime-store methods that mirror MCP operations:

- `listMcpGlobals` or `queryMcp` for global/project projections.
- `addMcpGlobal`, `updateMcpGlobal`, `removeMcpGlobal`.
- `enableMcpForProject`, `disableMcpForProject`.
- `startMcpInstance`, `stopMcpInstance`, `restartMcpInstance`.
- `callMcpTool` for optional test invocation.

Remove keeps the existing `stop:false` default. If running instances block removal, the dialog displays blocked project paths and requires an explicit destructive confirmation to retry with `stop:true`.

### Decision 5: Client SDK owns browser-facing MCP types

Studio should not import `packages/app-server/src/mcp-system/types.ts`. The shared client layer should export browser-facing input/view types, and runtime-store methods should call tRPC or descriptor-backed endpoints. If the first implementation bridges through runtime-local descriptors, the SDK still presents stable typed methods instead of forcing Studio to hand-build raw descriptor payloads.

### Decision 6: Default snapshot views use structured value primitives

Tool/resource/prompt schemas, call args, and call results are structured data. Studio should reuse the existing `structured-value-viewer` style of component rather than inventing MCP-specific JSON rendering.

### Decision 7: Interaction tests start from stories

The MCP workbench should ship Storybook/Vitest DOM stories for:

- empty runtime/no runtime selected
- global-only list
- project projection with disabled default, enabled stopped, running, and failed rows
- remove blocked by running projects
- lifecycle controls disabled until exact project enablement exists
- snapshot tools/resources/prompts detail
- optional test-call dialog with success and error results

Route-level browser acceptance can be added after the workbench is wired to a real daemon fixture.

## Risks / Trade-offs

- Runtime scope confusion → The toolbar must visibly show the selected runtime/Avatar authority and settle into an explicit no-runtime state when none exists.
- Accidental project enablement → Add global and tool-call flows must not enable a project unless the user explicitly toggles enablement or confirms `autoEnable`.
- Running process deletion risk → Remove default remains non-destructive. `stop:true` is only available from a blocked-removal confirmation showing affected project paths.
- Snapshot staleness → The detail panel labels snapshots as project-local and includes lifecycle/snapshot time so stale stopped snapshots are not mistaken for live truth.
- tRPC surface growth → Prefer a compact MCP router/facade that maps one-to-one to existing `McpSystemSurface`; do not expose raw SQL as the only browser UI data path if the UI needs stable list-detail projections.

## Migration Plan

1. Add client-sdk MCP input/view types and runtime-store facade methods.
2. Add daemon/browser routes that call the owning runtime's MCP surface.
3. Add `/mcp` route, app-shell navigation item, workbench layout, and mocked Storybook states.
4. Wire real runtime-store data and mutations.
5. Add DOM contract tests and route-level smoke tests for desktop and mobile.
6. Update Studio and client-runtime-store durable specs before archiving.

Rollback is straightforward because this is an additive Studio product surface. Removing the `/mcp` route and SDK facade leaves existing CLI/API MCP behavior intact.
