## ADDED Requirements

### Requirement: ChatApp metadata disclosure SHALL honor channel access role
The ChatApp metadata disclosure surface SHALL expose read-only channel facts for all valid roles and SHALL only expose metadata mutation or participant administration controls when the current channel access role is `admin`.

#### Scenario: Non-admin viewer sees read-only metadata
- **WHEN** a user opens the metadata disclosure with a `readonly` or `member` token
- **THEN** the disclosure shows channel facts and participant information
- **THEN** edit, participant-management, and token-management controls are hidden or disabled

#### Scenario: Admin viewer can manage the channel
- **WHEN** a user opens the metadata disclosure with an `admin` token
- **THEN** the disclosure shows edit actions for title and participant management
- **THEN** token issuance or revocation actions are available from the same disclosure flow
