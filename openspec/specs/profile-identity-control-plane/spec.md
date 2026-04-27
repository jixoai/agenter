# profile-identity-control-plane Specification

## Purpose
Define canonical auth identity, reference binding, and public projection rules so one durable auth record can be addressed without collapsing Avatar semantics into auth state. The legacy `profile-*` capability id is retained only for compatibility.

## Requirements
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

#### Scenario: Public projection omits private auth state
- **WHEN** an unauthenticated caller resolves a public auth projection or icon owner
- **THEN** the service returns public metadata and media projection only
- **THEN** challenges, JWT state, and other private auth records are not exposed in the response

### Requirement: Temporary identifiers SHALL resolve as fallback-only virtual profiles
The profile service SHALL accept arbitrary string identifiers as temporary identity seeds for deterministic fallback rendering and public projection. Temporary identifiers SHALL NOT create durable profiles or durable identifier bindings until an authenticated identifier claims or links them through an explicit mutation flow.

#### Scenario: Temporary identifier resolves a virtual profile projection
- **WHEN** a caller requests profile media or public projection for an unbound temporary identifier string
- **THEN** the service returns a deterministic virtual profile projection derived from that string
- **AND** no durable profile row is created solely because of the read

#### Scenario: Durable profile read takes precedence over temporary fallback
- **WHEN** a caller requests an identifier that is already durably bound to a profile
- **THEN** the service returns the bound canonical profile projection
- **AND** it does not fall back to the temporary virtual-identity path

### Requirement: Auth system SHALL mint managed principals for avatar entities
The auth identity control plane SHALL treat Avatar as a managed-principal kind. Public avatar metadata SHALL live on the avatar principal record instead of being invented as a second app-server-only identity row.

#### Scenario: Avatar principal is created with public metadata
- **WHEN** a caller creates a managed principal with `kind: "avatar"` and metadata including `nickname` plus optional `displayName` or nullable `classify`
- **THEN** the service returns a stable avatar principal identity and persists that metadata on the principal
- **AND** later reads resolve the same avatar identity without requiring a second avatar registry

#### Scenario: App-server bridge does not become a second identity authority
- **WHEN** app-server exposes convenience mutations or queries for global avatar creation and listing
- **THEN** it delegates identity creation and lookup to AuthSystem/profile-service
- **AND** it does not persist a competing avatar identity truth outside the managed principal control plane

### Requirement: Identity control plane SHALL use auth-service as the canonical authority name
The identity control plane SHALL name the auth authority as auth-service in package imports, child-runtime descriptors, and durable platform documentation. `profile-service` SHALL remain only as a compatibility alias; profile projections and profile media owners remain domain objects served by that authority.

#### Scenario: App-server delegates identity creation to auth-service
- **WHEN** app-server exposes convenience mutations or queries for global avatar creation, managed principal listing, or profile projection reads
- **THEN** it delegates identity creation and lookup to auth-service
- **THEN** any profile-service bridge or package path is only a compatibility alias to the same authority

#### Scenario: Profile owner semantics remain intact
- **WHEN** a caller resolves public profile projection or profile icon media
- **THEN** the object remains a profile projection or profile media owner
- **THEN** the service package and runtime identity remain auth-service
