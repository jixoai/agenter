## ADDED Requirements

### Requirement: Profile service SHALL bind multiple durable identifiers to one profile
The profile service SHALL represent durable identity as a canonical profile record with one or more bound authenticated identifiers. The first slice SHALL support `email`, `wallet_evm`, and `wallet_solana` as durable identifier families, and later bindings SHALL attach to the existing profile instead of forcing per-identifier duplicate profiles.

#### Scenario: One profile owns email and wallet identifiers
- **WHEN** a user authenticates an email identifier and later links an EVM or Solana wallet identifier
- **THEN** the service binds both identifiers to the same canonical profile
- **AND** profile reads through either identifier resolve the same profile metadata and icon state

#### Scenario: Re-authenticating an existing identifier resolves the bound profile
- **WHEN** a caller authenticates an identifier that is already bound to a profile
- **THEN** the service resolves that canonical profile instead of creating a duplicate profile
- **AND** identifier uniqueness is preserved across the service

### Requirement: Profile service SHALL provide durable metadata control for canonical profiles
The profile service SHALL expose canonical read/write APIs for profile metadata including nickname, display label, phones, addresses, and extensible structured metadata. Metadata writes SHALL target the canonical profile, not an identifier-specific shadow copy.

#### Scenario: Metadata update is visible through all bound identifiers
- **WHEN** an authenticated caller updates the nickname or metadata for a profile
- **THEN** later reads through any identifier bound to that profile return the updated metadata
- **AND** the service does not require the caller to update each identifier separately

#### Scenario: Public projection omits private auth state
- **WHEN** an unauthenticated caller resolves a public profile projection or icon owner
- **THEN** the service returns public metadata and media projection only
- **AND** WebAuthn credentials, challenges, and auth-token records are not exposed in the response

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
