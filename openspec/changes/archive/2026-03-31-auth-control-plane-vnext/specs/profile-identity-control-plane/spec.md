## MODIFIED Requirements

### Requirement: Profile service SHALL bind multiple durable identifiers to one profile
Auth service SHALL represent durable login identity as one canonical auth record anchored by a canonical address or public key. Email and other references MAY be attached for display or interoperability, but they SHALL NOT create alternate durable login identities or parallel canonical auth records.

#### Scenario: Canonical auth id survives metadata expansion
- **WHEN** an auth identity later adds display metadata or reference identifiers
- **THEN** the canonical auth id remains the same address-derived identity
- **THEN** all authenticated reads resolve the same canonical auth record

#### Scenario: Reference identifier does not mint a second auth identity
- **WHEN** a caller stores an email or other reference on an existing auth identity
- **THEN** the service does not create a second durable auth identity keyed by that reference
- **THEN** the reference remains subordinate to the canonical auth identity

### Requirement: Profile service SHALL provide durable metadata control for canonical profiles
Auth service SHALL expose canonical read and write APIs only for auth-scoped metadata, including display label and public identity fields. Avatar prompt, persona, and workspace-scoped behavior SHALL remain outside this metadata surface.

#### Scenario: Auth metadata is visible through public projection
- **WHEN** an authenticated caller updates the auth display label or public metadata
- **THEN** later reads of that auth projection return the updated values
- **THEN** the service does not require separate per-reference metadata updates

#### Scenario: Avatar configuration is not written into auth metadata
- **WHEN** a caller edits Avatar prompt or workspace behavior for a session
- **THEN** those changes are stored outside the auth metadata record
- **THEN** later auth reads do not expose workspace-scoped Avatar behavior as auth state
