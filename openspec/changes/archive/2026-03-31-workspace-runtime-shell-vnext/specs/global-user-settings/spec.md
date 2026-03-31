## REMOVED Requirements

### Requirement: Global user settings SHALL be reachable from global navigation
**Reason**: user-level settings 不再通过独立的 `GlobalSettings` 一级路由暴露，而是收口到 `~/` global workspace 内。
**Migration**: 使用 `Workspaces` 打开 global workspace rooted at `~/`，并在该 surface 内访问 user-level settings。

### Requirement: Global user settings SHALL own avatar management
**Reason**: avatar 管理不再属于独立 global settings 页面，而是属于 global/workspace 统一的 `Workspaces` 模型。
**Migration**: 在 global workspace 或 regular workspace 的 `Avatars` tab 中管理 Avatar 目录与启动入口。

## ADDED Requirements

### Requirement: Global user settings SHALL be surfaced through the global workspace
The system SHALL expose app-level user preferences, auth-adjacent controls, and default-avatar selection through the special global workspace rooted at `~/` rather than through a standalone global-settings route.

#### Scenario: User manages app-level settings from the global workspace
- **WHEN** the user opens the global workspace rooted at `~/`
- **THEN** the application shows user-level settings and app-wide controls through that workspace detail surface
- **THEN** the user does not need a separate primary navigation route to reach them

#### Scenario: Global workspace remains reachable without a running avatar
- **WHEN** the user has no running avatar selected
- **THEN** the global workspace can still be opened from `Workspaces`
- **THEN** user-level settings remain available without requiring an active session

### Requirement: Global user settings SHALL preserve local-machine storage boundaries
The global workspace settings flow SHALL keep local-machine secrets and auth tokens in a local editable layer instead of writing them into the shared global settings file.

#### Scenario: Global auth token writes to local settings
- **WHEN** the user saves a JWT, auth token, or private-key-derived local credential from the global workspace
- **THEN** the system writes that value into the editable global local layer
- **THEN** the shared global settings layer remains unchanged for that sensitive field
