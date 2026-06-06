# User Review Loop: Heartbeat Status, Scroll Owner, And Toolbar Chrome

## User Findings

- Avatar startup status was not visible on either the Avatars directory or the Heartbeat detail page.
- When the default Avatar produced Heartbeat rows, the detail page overflowed instead of scrolling; the page needed to prove it uses Framework7 `PageContent` as the scroll owner.
- The bottom bar needed to be Framework7 `Toolbar` with bottom position. Status belongs in the top `Subnavbar` title, while the bottom toolbar should only expose actions.
- In `configable` mode, Compact and Config actions were missing from the bottom toolbar.

## Corrections

- Added package-level `AvatarRuntimeStatus` and example adapter `avatarStatuses`, derived from existing client-sdk runtime-store sessions/runtimes without adding backend endpoints.
- The Avatars directory now shows per-Avatar status such as `Running` or `Stopped`; the Heartbeat detail subnavbar shows runtime/live-push/group/context status.
- The example detail route and package `HeartbeatPage` now use `Page -> Navbar -> Subnavbar`, official `PageContent`, and direct child `Toolbar position="bottom"`.
- `HeartbeatView` no longer owns an inner scroll container on the detail route; the official Framework7 `PageContent` owns vertical scroll while the stream is normal document flow.
- `configable` mode renders Compact and Config toolbar affordances. Missing authority/handlers leave the affected action disabled with an objective unavailable reason instead of removing the whole toolbar.

## Evidence

- Mobile directory with Avatar statuses: `.screenshot/web-heartbeat-view/mobile-directory-heartbeat-fix.png`
- Mobile Heartbeat with Subnavbar status, PageContent scroll, and bottom Toolbar actions: `.screenshot/web-heartbeat-view/mobile-heartbeat-toolbar-fix.png`
- Desktop Heartbeat with the same page law: `.screenshot/web-heartbeat-view/desktop-heartbeat-toolbar-fix.png`
- Playwright inspection confirmed mobile `PageContent` has `overflowY: auto`, `scrollHeight: 18767`, and `clientHeight: 664`, while `heartbeat-stream` has `overflowY: visible`.
- Playwright inspection confirmed bottom toolbar classes include `toolbar toolbar-bottom` and text `Compact Config`.
- Verification commands passed after the correction.
