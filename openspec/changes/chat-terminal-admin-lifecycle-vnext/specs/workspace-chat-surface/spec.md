## MODIFIED Requirements

### Requirement: Workspace chat surface SHALL expose admin lifecycle controls
Workspace chat surface MUST provide discoverable admin controls for channel create/focus/archive and metadata editing stability.

#### Scenario: Metadata editor keeps input focus while typing participant ids
- **WHEN** admin edits participant rows
- **THEN** row identity remains stable and inputs do not blur/remount after each keystroke

#### Scenario: Channel actions are explicit
- **WHEN** admin opens channel controls
- **THEN** focus and archive actions are available with role-aware guards
- **AND** `chat-main` archive action is disabled with explanatory feedback
