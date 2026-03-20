# global-user-settings Specification

## Purpose
TBD - created by archiving change workspace-identity-and-chat-surface. Update Purpose after archive.
## Requirements
### Requirement: Global user settings SHALL be reachable from global navigation
The WebUI SHALL expose a GlobalSettings entry from the application navigation rail, and that entry SHALL open the user-level settings surface without depending on any current workspace route header.

#### Scenario: Left navigation opens global settings
- **WHEN** the user activates the GlobalSettings entry in the application navigation rail
- **THEN** the application navigates to the global user-settings surface
- **THEN** the current page header does not need to provide a duplicate global-settings trigger

### Requirement: Global user settings SHALL own avatar management
The system SHALL expose avatar catalog and avatar presentation management through global user settings rather than workspace settings.

#### Scenario: User manages avatar catalog globally
- **WHEN** the user opens global user settings
- **THEN** the surface shows available avatars and the current user-level avatar selection
- **THEN** avatar upload and presentation changes are applied at the user level instead of the workspace level

