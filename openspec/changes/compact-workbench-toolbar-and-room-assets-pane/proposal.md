# compact-workbench-toolbar-and-room-assets-pane

## Why

The current shared workbench toolbar drifted into a page-layout engine instead of remaining a fixed chrome slot. It still grows vertically, encodes row semantics in the shared primitive, and breaks badly on narrow room surfaces. At the same time, the Room page is still missing the high-density, operator-first toolbar contract and the `assets` pane that should expose room-owned uploads as a first-class view next to chat.

## What Changes

- Recast the shared workbench page toolbar as a fixed `48px` chrome slot instead of a multi-row layout primitive.
- Move dense Room toolbar layout ownership into the Room feature itself while preserving shared container-query and JS responsive state from the toolbar wrapper.
- Add room-local toolbar actions for message search, add-user, and manage.
- Add Room view chips for `chat` and `assets`.
- Add a room asset listing control plane and WebUI assets pane that surfaces uploaded files with upload date and uploader metadata.

## Impact

- Affected specs: `workbench-tabs`, `message-system-surface`, `room-media-assets`
- Affected code: shared workbench toolbar/window primitives, Messages room route/surface, client-sdk room APIs, app-server room asset persistence and TRPC router, plus Storybook/test coverage
