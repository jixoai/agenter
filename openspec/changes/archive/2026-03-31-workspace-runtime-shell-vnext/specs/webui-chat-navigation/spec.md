## REMOVED Requirements

### Requirement: Quick Start is a primary application view
**Reason**: Quick Start 不再是独立一级页面，而是 `Workspaces / Welcome` 中的启动编排器。
**Migration**: 使用 `Workspaces` 进入 `Welcome`，并在同一 surface 内完成 workspace/avatar 启动与返回流。

### Requirement: Chat route SHALL own the primary session action surface
**Reason**: session-first Chat route 不再是 primary shell 的主动作入口；启动与附加动作改由 `Workspaces / Welcome` 与 `Avatars` surfaces 承载。
**Migration**: 使用 `Workspaces` 中的启动编排器或 workspace avatar actions 管理启动与附加；global room 浏览改走 `Chats`。

## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide `Workspaces` as a primary application surface that integrates fixed `Welcome` and `History` entries, the special global workspace rooted at `~/`, and workspace-scoped tabs such as `Settings` and `Avatars`. `Chats` and `Terminals` SHALL remain separate primary resource surfaces instead of being folded back into workspace detail routes.

#### Scenario: Workspaces opens with fixed welcome and history entries
- **WHEN** the user opens the `Workspaces` primary view
- **THEN** the surface shows fixed `Welcome` and `History` entries before workspace-scoped tabs
- **THEN** the user does not need to leave `Workspaces` to reach the start flow or workspace history

#### Scenario: Global workspace uses the same shell model
- **WHEN** the user opens the special global workspace rooted at `~/`
- **THEN** the application renders it through the same Workspaces detail shell as other workspaces
- **THEN** global settings and avatar management are expressed through that workspace model instead of a separate primary route

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the outer application shell owns the primary `Chats / Terminals / Workspaces` navigation and the secondary `Running Avatars` rail, while the `Workspaces` surface owns its own local tabs, notices, and actions. GlobalSettings MUST NOT reappear as a separate app-level route or as duplicated header chrome.

#### Scenario: Primary shell and workspace shell stay visually distinct
- **WHEN** the user is browsing the `Workspaces` surface
- **THEN** the outer shell keeps only global navigation and runtime rail responsibilities
- **THEN** workspace-local actions such as avatar start, topology edits, and settings tabs remain inside the Workspaces surface

#### Scenario: Global settings does not reappear as duplicate chrome
- **WHEN** the shell renders desktop or mobile navigation
- **THEN** there is no separate `GlobalSettings` primary destination or header shortcut
- **THEN** the global workspace rooted at `~/` remains the single navigation entry point for global settings behavior

### Requirement: The application SHALL provide stable primary and secondary session navigation
The WebUI SHALL render `Chats`, `Terminals`, and `Workspaces` as the only primary navigation destinations, and it SHALL render running avatars through a secondary `Running Avatars` navigation model on both desktop and compact layouts.

#### Scenario: Primary navigation stays fixed to three destinations
- **WHEN** the application renders its primary navigation
- **THEN** the only primary entries are `Chats`, `Terminals`, and `Workspaces`
- **THEN** neither running avatars nor global settings are promoted into that primary destination set

#### Scenario: Running avatars stay secondary across viewports
- **WHEN** one or more avatars are running
- **THEN** the application exposes them through a secondary `Running Avatars` surface on desktop and mobile
- **THEN** opening or closing avatars does not mutate the primary navigation model

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL keep one shared master-detail model inside `Workspaces`, where the master side owns `Welcome`, `History`, the global workspace, and regular workspace entries, while the detail side owns the selected workspace or runtime-facing surface. Global `Chats` and `Terminals` SHALL NOT be embedded back into that master-detail stack.

#### Scenario: Desktop Workspaces keeps one master-detail layout
- **WHEN** the application renders `Workspaces` on a desktop-sized viewport
- **THEN** the workspace selector and the selected detail surface are visible within one shared master-detail layout
- **THEN** global `Chats` and `Terminals` remain separate primary pages instead of nested panes inside that layout

#### Scenario: Compact Workspaces uses one detail flow
- **WHEN** the application renders `Workspaces` on a compact viewport and the user selects `Welcome`, `History`, or a workspace entry
- **THEN** the selected detail surface opens through the shared compact detail flow
- **THEN** the user does not need a second navigation model to inspect global workspace or regular workspace details

### Requirement: Workspaces History SHALL list workspaces instead of session timelines
The `History` entry inside `Workspaces` SHALL list all known workspaces rather than individual session rows. It SHALL sort by the last time a session was started in that workspace by default, and it SHALL allow alternate sorts by path and by workspace name.

#### Scenario: History defaults to last-used ordering
- **WHEN** the user opens `Workspaces / History`
- **THEN** the surface lists known workspaces ordered by the most recent session-start activity in each workspace
- **THEN** the newest active workspace appears before older ones by default

#### Scenario: History can change sort mode
- **WHEN** the user changes the History sort mode
- **THEN** the surface can reorder the same workspace list by path or by workspace name
- **THEN** the page still remains a workspace list instead of switching into session-history rows

## ADDED Requirements

### Requirement: Session runtime detail shells SHALL remain runtime-only surfaces
The WebUI SHALL expose running-avatar detail shells as secondary runtime surfaces that focus on runtime panels such as `Devtools` and `Settings`, and those shells MUST NOT duplicate the primary global `Chats` or `Terminals` browsing experience.

#### Scenario: Running avatar detail excludes global resource tabs
- **WHEN** the user opens a running-avatar detail shell
- **THEN** the shell exposes runtime-specific panels instead of `Chats` and `Terminals` peer tabs
- **THEN** any room or terminal deep link leaves that shell and navigates to the corresponding global page

#### Scenario: Running avatar detail can be opened from secondary entry points
- **WHEN** the user activates a running-avatar entry from the secondary rail or from a workspace avatar list
- **THEN** the application opens the same runtime detail shell model for that session
- **THEN** the shell behavior does not depend on which entry point launched it
