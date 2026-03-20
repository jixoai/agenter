## Why

The route-driven shell landed, but the UI contract is still inconsistent: running sessions are hard to reach, loading behavior drifts from panel to panel, and the page chrome exposes too many actions at once. This makes the application feel like stacked demos instead of one coherent workspace-oriented product.

## What Changes

- Add a secondary session rail for running sessions so desktop users can switch active work without polluting the primary sidebar.
- Add a shared async-surface contract so `Quick Start`, `Workspaces`, `Sessions`, `Settings`, and workspace tools all render the same four loading/data states.
- Refine the workspace shell hierarchy so the global sidebar stays stable, the workspace shell owns its own chrome, and mobile actions collapse into compact shadcn-style menus/sheets.
- Surface unread notification state through the new running-session entry points instead of only through workspace/session lists.

## Capabilities

### New Capabilities
- `workspace-shell-session-rail`: Secondary running-session navigation for desktop and compact session switching affordances for mobile.
- `async-surface-states`: Shared four-state loading contract and reusable async presentation primitives for WebUI application surfaces.

### Modified Capabilities
- `webui-chat-navigation`: Tighten the shell hierarchy, header behavior, and route-aware navigation so primary navigation remains stable while workspace/session navigation becomes clearer.
- `session-notifications`: Extend unread projection usage so running-session navigation surfaces unread state consistently.

## Impact

- Affected packages: `@agenter/webui`
- Affected UI systems: `AppRoot`, `AppHeader`, `WorkspaceShellFrame`, `WorkspacesPanel`, `WorkspaceSessionsPanel`, `SettingsPanel`, `QuickStartView`, shared shadcn-style UI primitives, Storybook DOM coverage
- Affected contracts: WebUI navigation hierarchy, panel loading semantics, session unread badge placement
