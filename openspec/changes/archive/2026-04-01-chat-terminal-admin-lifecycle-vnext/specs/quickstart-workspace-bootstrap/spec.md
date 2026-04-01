## ADDED Requirements

### Requirement: Quick Start SHALL support workspace-local chat and terminal bootstrap config
Quick Start MUST provide admin controls to edit chat-main metadata defaults and boot terminal descriptors before session creation.

#### Scenario: Room config edits persist to workspace-local settings
- **WHEN** user edits quickstart room config and confirms
- **THEN** workspace local settings layer is updated
- **AND** next created session reads those defaults during startup

#### Scenario: Terminal chips model boot terminal descriptors
- **WHEN** user adds/edits/removes quickstart terminal chips
- **THEN** descriptors are persisted to workspace local settings
- **AND** next created session boots terminals according to descriptors
