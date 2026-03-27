## MODIFIED Requirements

### Requirement: Runtime terminal lifecycle SHALL expose list/create/focus/delete contracts
Session runtime APIs MUST expose terminal lifecycle operations aligned with terminal control-plane behavior.

#### Scenario: Create terminal with advanced profile
- **WHEN** caller requests terminal create with process/profile fields
- **THEN** runtime creates the terminal instance and returns terminal descriptor
- **AND** optional focus behavior is applied through focus API

#### Scenario: Focus and delete are explicit lifecycle operations
- **WHEN** caller focuses or deletes a terminal
- **THEN** runtime updates focused terminal ids and terminal registry accordingly
- **AND** lifecycle attention commits are emitted for observability
