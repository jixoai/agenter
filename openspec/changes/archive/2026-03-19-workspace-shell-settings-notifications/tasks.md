## 1. Workspace Settings Contracts

- [x] 1.1 Add workspace-scoped settings list/read/save APIs in `@agenter/app-server` keyed by `workspacePath`
- [x] 1.2 Update `@agenter/client-sdk` types and runtime store helpers to consume workspace-scoped settings APIs
- [x] 1.3 Refactor the WebUI settings data flow so `SettingsPanel` loads from the selected workspace instead of `activeSessionId`

## 2. Session Notification Projection

- [x] 2.1 Add an in-memory notification registry in `@agenter/app-server` for unread assistant `to_user` messages by session
- [x] 2.2 Expose notification snapshot, consume, and subscription surfaces through the TRPC router and client SDK
- [x] 2.3 Wire WebUI session/workspace views to render unread badges and consume notifications only when Chat is visible and focused

## 3. Route-Driven WebUI Shell

- [x] 3.1 Introduce TanStack Router in `@agenter/webui` and replace the current top-level local-state navigation with route-owned views
- [x] 3.2 Rebuild the global shell so the sidebar only shows `Quick Start` and `Workspaces`, and the workspace shell owns `Chat`, `Devtools`, and `Settings`
- [x] 3.3 Upgrade the app header and mobile bottom navigation to reflect the active route, workspace, and selected session context
- [x] 3.4 Remove obsolete global chat/settings/session-shortcut navigation state from `App.tsx` and related shell components

## 4. Verification

- [x] 4.1 Add app-server and client-sdk BDD tests for workspace settings and session notification behavior
- [x] 4.2 Add Storybook DOM tests for workspace settings access, workspace shell navigation, and unread badge behavior
- [x] 4.3 Run targeted typecheck and test commands for the affected packages and fix regressions
