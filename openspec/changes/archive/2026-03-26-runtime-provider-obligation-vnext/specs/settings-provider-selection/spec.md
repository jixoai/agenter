## MODIFIED Requirements

### Requirement: Provider configuration SHALL resolve the intended runtime provider
Session config resolution SHALL preserve the operator's active provider selection instead of silently replacing it with a checked-in project default.

#### Scenario: User-selected provider beats project default
- **GIVEN** user settings select `ai.activeProvider = kimi`
- **AND** project settings define a checked-in `default` provider
- **WHEN** session config is resolved for that workspace
- **THEN** the resolved runtime provider id is `kimi`
- **AND** the project provider catalog remains available without replacing the user's active selection

#### Scenario: Local override can still win
- **GIVEN** local workspace settings define `ai.activeProvider = some-local-provider`
- **WHEN** session config is resolved
- **THEN** the local active provider selection overrides user and project defaults for that workspace instance
