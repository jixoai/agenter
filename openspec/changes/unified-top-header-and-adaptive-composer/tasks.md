## 1. Unified shell header

- [x] 1.1 Add the `webui-chat-navigation`, `workspace-shell-session-rail`, and adaptive-affordance spec deltas.
- [x] 1.2 Replace `AppHeader + WorkspaceHeader` with a single `TopHeader` surface and remove `BottomNavbar` routing.
- [x] 1.3 Keep `GlobalSettings` in sidebar/drawer navigation only and verify compact/desktop navigation paths still work.

## 2. Adaptive composer controls

- [x] 2.1 Add a reusable adaptive icon-button primitive powered by container queries and `ResizeObserver`.
- [x] 2.2 Refactor the Chat composer toolbar so shortcut/help content collapses into a `?` rich-tooltip and Attach/Screenshot labels hide when space is tight.
- [x] 2.3 Preserve accessible labels/tooltips for icon-only affordances and keep Send as the dominant primary action.

## 3. Verification

- [x] 3.1 Add Storybook DOM coverage for unified top-header navigation and compact/desktop shell rendering.
- [x] 3.2 Add Storybook DOM coverage for adaptive composer label collapse and rich-tooltip help behavior.
- [x] 3.3 Run targeted `@agenter/webui` unit + DOM tests and update this task list from verified results.
