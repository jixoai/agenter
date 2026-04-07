## Why

Real mobile walkthrough shows the top-level left sidebar disappears entirely on compact viewports because the shared `Sidebar` primitive switches the app shell into a sheet/drawer branch. This violates the current operator requirement that the left sidebar remain a persistent window switcher and that sidebar collapse/expand controls stay inside that left rail instead of moving into page chrome.

## What Changes

- Replace the app-shell mobile drawer behavior with a persistent docked sidebar rail that remains visible on compact viewports.
- Give the shared `Sidebar` primitive an explicit mobile presentation mode so the app shell can opt into docked behavior without breaking other sidebar consumers.
- Update compact shell specs so running-avatar secondary navigation remains attached to the persistent left rail instead of a hidden drawer.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `svelte-webui-platform`: compact app-shell navigation stays visible as a persistent left window-switcher rail.
- `workspace-shell-session-rail`: compact running-avatar navigation remains nested under `Avatars` in the same persistent rail.

## Impact

- Affected code: `packages/webui/src/lib/components/ui/sidebar/sidebar.svelte`, `packages/webui/src/lib/features/shell/app-shell.svelte`, related contract specs
- Affected systems: top-level WebUI shell across `Avatars`, `Messages`, and `Terminals`
- Validation: focused shell contract tests plus real mobile/desktop browser walkthrough
