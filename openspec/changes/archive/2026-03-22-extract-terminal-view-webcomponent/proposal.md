## Why

The current terminal rendering logic still lives inside WebUI-specific code and does not yet provide the standalone renderer contract from the original target. That blocks reuse, keeps xterm rendering bugs tied to app-specific layout assumptions, and prevents the app from treating terminal rendering as a portable component with a stable transport boundary.

## What Changes

- Extract a standalone `terminal-view` WebComponent package from the current WebUI terminal rendering path.
- Build the component with `lit.js` and a standard websocket PTY transport contract instead of WebUI-local runtime glue.
- Define renderer scroll and overflow ownership so xterm surfaces render with stable scrollbars and one clear scroll container.
- Keep WebUI as a consumer of the component instead of the long-term owner of the renderer implementation.

## Capabilities

### New Capabilities
- `terminal-view-component`: standalone `terminal-view` WebComponent built with `lit.js`.

### Modified Capabilities
- `terminal-pty-transport`: renderer consumers connect through the terminal-system websocket PTY transport contract.
- `workspace-devtools-surface`: WebUI consumes the new terminal-view component instead of maintaining a app-local terminal renderer.
- `overflow-layout-contract`: terminal renderer scroll ownership and fallback behavior are formalized for xterm surfaces.

## Impact

- Affected code: new terminal-view package, `packages/webui`, and the terminal transport adapter layer.
- Affected APIs: renderer component props/events, websocket PTY connection usage, and terminal embed integration points.
- Affected tests: terminal-view DOM tests, WebUI integration tests, and browser walkthroughs for scrollbar/scroll ownership.

## Delivery Order

1. Consume websocket PTY transport from `modernize-terminal-control-plane`.
2. Consume the cleaned host-side terminal contract from `propagate-terminal-contract-to-clients`.
3. Extract the renderer into a standalone package with one explicit scroll owner.
4. Replace WebUI-local renderer glue only after the standalone component and scroll behavior are verified.
