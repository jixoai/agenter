## ADDED Requirements

### Requirement: Avatar settings SHALL persist local principal material

Avatar settings SHALL store durable principal identity material in the avatar-local settings file.

#### Scenario: Avatar local settings contain principal material
- **WHEN** an avatar is initialized for a workspace
- **THEN** its `settings.local.json` includes `principalId`, `publicKey`, `privateKey`, and `algorithm`
- **AND** the stored principal id is reused for later session/runtime binding
