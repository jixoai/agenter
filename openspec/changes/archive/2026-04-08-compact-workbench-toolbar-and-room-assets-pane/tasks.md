## 1. Spec

- [x] 1.1 Add delta specs for fixed `48px` workbench toolbar slots and Room-owned dense toolbar content
- [x] 1.2 Add delta specs for the Room `chat/assets` body switch and room asset listing control plane

## 2. Platform

- [x] 2.1 Refactor `WorkbenchWindow` and `WorkbenchToolbar` so the shared toolbar is a fixed-height slot with responsive state, not a row-layout engine
- [x] 2.2 Update shared toolbar stories/tests to assert the fixed-height chrome law

## 3. Room Surface

- [x] 3.1 Rebuild the Room toolbar content into the dense two-row layout with avatar, viewer title, action icons, and `chat/assets` chips
- [x] 3.2 Add Room-local message search interaction that navigates currently loaded transcript rows
- [x] 3.3 Keep `page_content` pure by switching between `chat` and `assets` body modes instead of stacking extra headers

## 4. Room Assets

- [x] 4.1 Extend room asset persistence to capture uploader identity for new uploads and expose a room asset list query
- [x] 4.2 Add client-sdk room asset cache/hydration helpers and wire the Room route to them
- [x] 4.3 Build the Room assets pane showing file metadata, upload date, and uploader

## 5. Verification

- [x] 5.1 Add/update app-server, client-sdk, and WebUI tests for room asset listing and uploader projection
- [x] 5.2 Add/update Storybook DOM coverage for the fixed toolbar height and Room toolbar compact layout
- [x] 5.3 Run targeted typecheck/tests for app-server, client-sdk, and webui
