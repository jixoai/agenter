## Why

Real browser walkthroughs now show that redirect-only WebUI entry pages are no longer stable in the browser. Navigating to `/`, `/avatars`, and similar shell-entry routes produces `500 Internal Error` instead of landing on their canonical child views, which breaks the first-level navigation law.

## What Changes

- Replace unstable redirect-only page entries with a durable entry-route pattern that works for direct loads and in-app navigation.
- Repair the current redirect chain for `/`, `/avatars`, and `/avatars/runtime/[sessionId]` so each entry lands on its canonical destination without flashing an error surface.
- Add focused verification for redirect-only entries in browser walkthroughs and route-level regression checks.

## Capabilities

### New Capabilities
- `webui-entry-redirects`: Stable browser-safe entry routes for redirect-only WebUI pages and nested shell entry points.

### Modified Capabilities
- `workspace-runtime-shell`: Runtime entry routes must land on the canonical runtime tab without exposing an intermediate error page.

## Impact

- Affected code: `packages/webui/src/routes/+page.*`, `packages/webui/src/routes/avatars/+page.*`, `packages/webui/src/routes/avatars/runtime/[sessionId]/+page.*`
- Affected systems: WebUI route entry flow, app-shell first-level navigation, browser walkthrough regression coverage
- Validation: focused browser walkthrough for `/`, `/avatars`, and runtime entry routes plus targeted WebUI type/tests as needed
