## Why

The current WebUI shell still diverges from the requested application hierarchy: running sessions live in a separate rail or header switcher instead of the highest-priority left navigation, and several panels still collapse loading and empty states into one ambiguous UI. This causes navigation inconsistency, weak mobile ergonomics, and repeated per-panel state handling.

## What Changes

- Move running session entry points into the highest-level left application navigation on desktop and into the shared navigation drawer on mobile.
- Remove the separate desktop session rail and mobile header-only running-session switcher in favor of one unified sidebar data model.
- Rebuild the shell layout so the left sidebar owns the outermost chrome, while the main shell owns `TopHeader`, route content, and workspace-only `BottomNavBar`.
- Upgrade async surface handling to an explicit four-state contract: empty-loading, empty-idle, ready-loading, and ready-idle.
- Apply the shared async-surface contract consistently across workspace, settings, model, terminal, tasks, process, and loopbus surfaces.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `webui-chat-navigation`: change the shell hierarchy so running sessions render inside the left sidebar / mobile drawer instead of a separate rail or header switcher.
- `async-surface-states`: make the four async surface states explicit and reusable across all fetch-driven application panels, not only a subset of workspace views.
- `session-notifications`: retarget unread indicators to the new sidebar and mobile drawer running-session entry points.
- `workspace-shell-session-rail`: replace the dedicated rail/switcher contract with a unified running-session navigation section that lives inside the application sidebar model.

## Impact

- Affected code is concentrated in `packages/webui`, especially the shell, header, sidebar, workspace shell frame, and panel surfaces.
- Storybook DOM tests and app integration tests must be updated to validate the new navigation hierarchy and four-state loading contract.
- No backend protocol change is required; the change is a WebUI shell and presentation refactor built on existing runtime/session/notification state.
