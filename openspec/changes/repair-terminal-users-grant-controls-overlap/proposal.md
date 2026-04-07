## Why

Real browser walkthrough shows that `Terminals > Users` still treats a wide viewport as a wide collaboration rail even when the detail pane itself is narrow. In the current desktop layout, the pane can collapse to roughly `344px`, which causes `Grant actor` to be overlapped by `Grant role` and blocks seat grants completely.

## What Changes

- Repair the terminal Users grant-access header so the actor selector, role selector, and grant action respond to the Users pane width instead of only the browser viewport width.
- Keep the existing stacked grant-access layout as the narrow-pane fallback for both mobile and desktop detail rails.
- Add focused regression coverage for the terminal Users pane layout law and real-browser proof for desktop and mobile.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `terminal-system-surface`: The Users pane grant controls must remain independently hittable when the collaboration rail is narrow, even inside a wide desktop viewport.

## Impact

- Affected code: `packages/webui/src/lib/features/terminals/terminal-system-surface.svelte`, new terminal Users layout helper/spec coverage
- Affected systems: WebUI terminal collaboration rail, responsive seat-grant controls
- Validation: focused WebUI typecheck/unit coverage plus browser walkthrough for desktop/mobile Users pane interaction
