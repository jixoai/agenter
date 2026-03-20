## 1. Contracts and guardrails

- [x] 1.1 Update `AGENTS.md` and related WebUI guidance so `GlobalSettings` is defined as a left-navigation global entry and `TopHeader` is explicitly limited to current-page location and local navigation.
- [x] 1.2 Add or update source-contract tests / guidance for tooltip usage, overflow ownership, background ownership, and small-viewport layout rules.

## 2. Shell navigation and settings split

- [x] 2.1 Refactor shell navigation so the left rail owns the `GlobalSettings` entry on desktop and the shared drawer owns it on compact layouts.
- [x] 2.2 Remove duplicated global-settings entry points from page-local headers and add clear code comments around `TopHeader` ownership boundaries.
- [x] 2.3 Add the global user-settings route / surface and keep workspace settings scoped to workspace-only layers.
- [x] 2.4 Add Storybook DOM and browser walkthrough coverage for desktop/mobile navigation, including the new GlobalSettings entry and the absence of polluted TopHeader actions.

## 3. Session and avatar identity media

- [x] 3.1 Add app-server media endpoints for Session icon upload/read and Avatar upload/read with distinct semantic URL spaces.
- [x] 3.2 Implement deterministic Session icon generation on the client with `OffscreenCanvas` (plus canvas fallback), workspace/session seeds, and `image/webp` upload.
- [x] 3.3 Implement deterministic backend SVG avatar fallback generation and wire avatar upload overrides.
- [x] 3.4 Connect Session icons and Avatars to navigation, Chat, and settings surfaces with focused unit coverage.

## 4. Chat and Devtools surface completion

- [x] 4.1 Restore end-to-end working image upload / paste / drag-drop behavior in the CodeMirror-based Chat composer, including preview and removal.
- [x] 4.2 Tighten Chat presentation so expert cycle actions stay behind bubble context menus / long-press and centered time dividers remain stable.
- [x] 4.3 Normalize Cycles / Devtools typography, color density, tooltip usage, and scroll ownership for desktop and compact layouts.
- [x] 4.4 Audit Chat / Devtools layout against the minimum 375x667 viewport and fix remaining overflow or non-scrollable surfaces.

## 5. Verification and rollout

- [x] 5.1 Add Storybook v10 + Vitest real DOM coverage for updated Chat media, navigation, settings, and Devtools components.
- [x] 5.2 Run focused `@agenter/webui` unit + DOM test suites and a browser walkthrough for desktop/mobile viewport regression evidence.
