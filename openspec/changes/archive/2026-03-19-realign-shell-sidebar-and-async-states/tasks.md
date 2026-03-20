## 1. Sidebar and shell hierarchy

- [x] 1.1 Replace the split `SidebarNav` / `SessionRail` rendering path with a unified sidebar section model for primary navigation and running sessions
- [x] 1.2 Refactor `AppRoot` so the left sidebar owns the outermost chrome and the right-side main shell owns header, status, and route content
- [x] 1.3 Simplify `AppHeader` for compact viewports and move mobile running-session access into the shared navigation drawer

## 2. Shared async-surface contract

- [x] 2.1 Upgrade `AsyncSurface` to an explicit four-state contract with reusable skeleton, empty, and overlay slots
- [x] 2.2 Apply the shared async-surface contract to workspace-facing panels (`QuickStartView`, `WorkspacesPanel`, `WorkspaceSessionsPanel`, `SettingsPanel`)
- [x] 2.3 Apply the shared async-surface contract to devtools panels (`ModelPanel`, `TerminalPanel`, `TasksPanel`, `ProcessPanel`, `LoopBusPanel`)

## 3. Verification

- [x] 3.1 Update Storybook stories and DOM-contract tests for the sidebar hierarchy, mobile drawer behavior, and four async surface states
- [x] 3.2 Update WebUI integration tests to cover running sessions in the left sidebar and correct first-load vs empty-state behavior
- [x] 3.3 Run focused WebUI test commands and fix regressions until the change is ready to archive
