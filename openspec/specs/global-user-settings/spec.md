# global-user-settings Specification

## Purpose
Define the durable user-level settings contract as surfaced through the special global workspace rooted at `~/`.

## Requirements

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
