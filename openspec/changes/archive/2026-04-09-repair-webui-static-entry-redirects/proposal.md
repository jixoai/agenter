## Why

Browser walkthrough of the default static `agenter web` entry uncovered that redirect-only WebUI entry routes still rely on `+page.server.ts` even though the app runs with `ssr = false` and adapter-static fallback delivery. That mismatch causes the browser to request `__data.json`, receive `200.html` instead, and fail hydration with `Unexpected token '<'`.

## What Changes

- **BREAKING** Replace redirect-only WebUI entry routes that currently depend on server redirects with CSR-compatible route modules.
- Keep the canonical redirect destinations unchanged: `/ -> /avatars`, `/avatars -> /avatars/workspace`, `/avatars/runtime/{sessionId} -> /avatars/runtime/{sessionId}/attention`.
- Update redirect contract tests so the durable law forbids reintroducing server-only redirect files for static SPA entry routes.
- Re-run default CLI static walkthrough on desktop and mobile after the route law changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `webui-entry-redirects`: redirect-only entry routes must resolve under static CSR delivery without requiring server `__data.json` responses.

## Impact

- Affected code: `packages/webui/src/routes`, WebUI redirect contract tests, and walkthrough verification.
- Affected UX: default `agenter web` root entry and nested runtime entry routes hydrate correctly instead of failing on first load.
- Affected systems: static CLI WebUI delivery and browser walkthrough coverage.
