## 1. Shell ownership refactor

- [x] 1.1 Simplify `AppHeader` and `AppRoot` so the global header only shows application-level location, passive status, and the compact drawer trigger
- [x] 1.2 Refactor `WorkspaceShellFrame` and `BottomNavBar` into a clear workspace `header / body / footer` structure without duplicated session identity or nested padding ownership
- [x] 1.3 Simplify the compact drawer so it only exposes primary navigation and running sessions, without workspace-local tabs or session actions

## 2. Route-local session surface

- [x] 2.1 Add a Chat route toolbar that owns session identity, passive session state, and a single state-driven session run control
- [x] 2.2 Move Chat-specific notices out of the global header and into route-local banners or surfaces

## 3. Verification and design guidance

- [x] 3.1 Update Storybook DOM coverage for the app header, workspace shell, bottom nav, and compact drawer hierarchy
- [x] 3.2 Update WebUI unit and integration tests for the single-button session control and deduplicated shell information architecture
- [x] 3.3 Add Apple-style information-architecture and action-hierarchy best practices to `AGENTS.md`
- [x] 3.4 Run focused WebUI validation and fix regressions until the change is ready to archive
