## ADDED Requirements

### Requirement: Auth flows SHALL be exposed through auth-service identity
Proof-bearing auth flows SHALL be documented, configured, and surfaced through auth-service identity. Legacy profile naming MAY remain as aliases for existing callers, but challenge, verification, JWT, and root-auth operations SHALL be owned by the canonical auth-service atom.

#### Scenario: Challenge text and descriptors use auth-service identity
- **WHEN** a caller starts a signed auth challenge
- **THEN** the challenge and service descriptor identify the authority as auth-service
- **THEN** the returned auth id and claims remain compatible with existing auth records

#### Scenario: Legacy profile env var is accepted as alias
- **WHEN** an operator supplies an auth token through a legacy profile-named environment variable during the compatibility window
- **THEN** the CLI accepts it as an alias for the canonical auth token input
- **THEN** canonical help text names the auth-service token source
