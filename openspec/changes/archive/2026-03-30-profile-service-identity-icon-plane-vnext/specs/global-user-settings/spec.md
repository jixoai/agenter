## MODIFIED Requirements

### Requirement: Global user settings SHALL own avatar management
The system SHALL expose durable profile management through global user settings rather than workspace settings. That surface SHALL list canonical profiles, indicate the active app-level profile selection where applicable, expose bound identifiers, and allow profile metadata plus icon uploads to be managed without requiring an active session.

#### Scenario: User manages durable profiles globally
- **WHEN** the user opens global user settings
- **THEN** the surface shows available durable profiles and the current app-level profile selection
- **THEN** profile icon upload and presentation changes are applied at the user level instead of the workspace level

#### Scenario: User links identifiers from global settings flows
- **WHEN** the user completes a supported identifier-linking flow from global settings
- **THEN** the resulting email or wallet identifier is attached to the selected canonical profile
- **AND** the updated identifier list is visible from the same global user-settings surface
