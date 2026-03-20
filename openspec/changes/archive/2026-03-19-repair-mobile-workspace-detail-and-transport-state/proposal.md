## Why

The latest real-browser audit closed most of the shell regressions, but two core behaviors are still broken: compact Workspaces cannot reliably enter the Sessions detail flow, and transport loss is not reflected objectively in the header or live Devtools subscriptions. Both bugs undermine the "application shell" contract because users cannot trust navigation state or connection state on mobile or during reconnect.

## What Changes

- Repair the shared Workspaces-to-Sessions master-detail flow so compact layouts open the Sessions detail surface when a workspace is selected, without relying on double-click activation.
- Introduce an explicit runtime transport-state contract that distinguishes `connecting`, `connected`, `reconnecting`, and `offline`, and use that contract for header rendering instead of a stale boolean guess.
- Restore retained runtime streams such as API-call subscriptions after reconnect so Devtools continues to show live data without requiring a manual route refresh.
- Add focused BDD/DOM/browser coverage for compact workspace detail flow, header transport state, and reconnect recovery.

## Capabilities

### New Capabilities

- `runtime-transport-state`: defines the client/runtime transport lifecycle, browser offline handling, and reconnect recovery for retained live streams.

### Modified Capabilities

- `webui-chat-navigation`: refine the shared Workspaces-to-Sessions master-detail contract so compact layouts open the Sessions detail flow from workspace selection, while keeping workspace shell routes and global chrome unchanged.

## Impact

- Affected code spans `packages/client-sdk` and `packages/webui`, with no new runtime package or external dependency required.
- Public client state changes by adding an explicit transport status alongside the existing derived `connected` flag.
- Storybook DOM tests, client-sdk BDD tests, and real browser walkthroughs need updates to lock the repaired behavior.
