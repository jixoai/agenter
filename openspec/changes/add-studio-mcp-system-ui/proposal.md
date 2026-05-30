## Why

`mcpSystem` already owns global MCP configs, exact-project enablement, lifecycle, snapshots, SQL query, and tool calls, but Studio has no operator-facing UI for those facts. Operators currently have to reason through CLI/API surfaces for a system that should be inspectable and manageable from the same Studio cockpit as Skills, Terminals, Workspaces, Messages, and Avatars.

## What Changes

- Add a Studio primary navigation destination for MCP that opens an independent `/mcp` workbench.
- Add a simpler-than-Skills MCP workbench for global configs, project enablement, lifecycle controls, capability snapshots, latest errors, action history, and optional tool-call testing.
- Expose typed client runtime-store MCP facade methods so Studio consumes daemon/client-sdk contracts instead of importing `app-server` or `mcp-system` internals.
- Preserve existing MCP laws: global add/remove are global-only, project enablement is exact-path, disabled globals are inert, snapshots are project-local, lifecycle controls are project-scoped, and MCP tools do not become provider direct tools.
- Keep WebUI/Studio and cli-shell independent. This change adds a Studio product surface only; it does not add cli-shell-specific controls or couple MCP UI to cli-shell sessions.

## Capabilities

### New Capabilities

- `studio-mcp-system-workbench`: Studio route, navigation, layout, and interaction contract for inspecting and managing MCP globals and project-scoped instances.

### Modified Capabilities

- `client-runtime-store`: add a typed MCP facade for Studio and other browser products to read MCP projections and issue MCP mutations through daemon contracts.

## Impact

- Studio UI: `extensions/studio/src/lib/features/mcp/**/*`, `extensions/studio/src/routes/(app)/mcp/**/*`, and `extensions/studio/src/lib/features/shell/app-shell.svelte`.
- Client SDK/runtime store: `packages/client-sdk/src/runtime-store.ts` and exported MCP view/input types.
- App server/trpc: browser-safe MCP routes or descriptor-backed bridge endpoints, implemented without exposing `mcpSystem` internals directly to Studio.
- Tests: BDD unit/contract tests for runtime-store MCP facade, Studio app-shell navigation, MCP workbench layout, project filter behavior, lifecycle/action controls, and Storybook DOM coverage for the add/edit/remove and project detail interactions.
