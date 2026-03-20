## 1. Shared UI Primitives

- [x] 1.1 Add shadcn-style `dropdown-menu` and `skeleton` wrappers in `packages/webui/src/components/ui`
- [x] 1.2 Add a shared `AsyncSurface` component that implements the four loading/data states used by application panels
- [x] 1.3 Add Storybook stories and DOM-contract tests for the new shared primitives

## 2. Workspace Shell Refactor

- [x] 2.1 Add a secondary `SessionRail` for running sessions on desktop and a compact running-session switcher for mobile
- [x] 2.2 Refactor `AppRoot` and `AppHeader` so the primary sidebar stays fixed, header actions collapse appropriately, and running-session unread state is surfaced from the existing runtime snapshot
- [x] 2.3 Refactor `WorkspaceShellFrame` so workspace routes share a cleaner chrome hierarchy with route-owned content and bottom navigation

## 3. Panel Adoption

- [x] 3.1 Migrate `QuickStartView`, `WorkspacesPanel`, and `WorkspaceSessionsPanel` to the shared async-surface contract and updated shell spacing
- [x] 3.2 Migrate `SettingsPanel` and workspace Devtools surfaces to the shared async-surface contract and compact header/action model
- [x] 3.3 Remove obsolete per-panel page-shell padding/card wrappers that conflict with the new hierarchy

## 4. Verification

- [x] 4.1 Add or update Storybook DOM tests for the refined shell, session rail, and async-surface behavior
- [x] 4.2 Run targeted WebUI test commands and a real browser walkthrough for Quick Start, Workspaces, workspace shell navigation, and unread session entry points
- [x] 4.3 Update this change checklist to reflect the verified implementation state
