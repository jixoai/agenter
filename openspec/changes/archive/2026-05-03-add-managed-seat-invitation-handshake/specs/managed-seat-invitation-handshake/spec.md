## ADDED Requirements

### Requirement: Managed seat invitations SHALL persist pending authority proposals without immediate activation

The platform SHALL represent manager-issued onboarding as a pending invitation fact bound to one resource kind, one resource id, one invited principal id, one inviter principal id, one resolved native authority payload snapshot, one opaque acceptance token, and one expiry. Creating the invitation SHALL NOT mint an active access token or native grant by itself.

#### Scenario: Manager issues a pending invitation

- **WHEN** an authorized manager invites principal `P` to resource `R` with some resource-native authority payload
- **THEN** the system persists a pending invitation for `R` and `P`
- **THEN** the invitation stores the resolved native authority payload that will be applied on acceptance
- **THEN** `P` does not appear as an active granted seat only because the invitation exists

### Requirement: Managed seat acceptance SHALL require proof from the invited principal

The platform SHALL activate a managed seat invitation only after the invited principal proves possession of its private key by signing an acceptance payload bound to the invitation token or id, the resource identity, the proposed authority snapshot or its digest, and the expiry window. Acceptance signed by any other principal MUST be rejected.

#### Scenario: Invited principal accepts a pending invitation

- **WHEN** principal `P` signs the acceptance payload for its pending invitation
- **THEN** the system marks the invitation accepted
- **THEN** the system applies the previously stored native authority payload to the target resource
- **THEN** the system returns the activated seat access projection for `P`

#### Scenario: Wrong principal cannot accept

- **WHEN** principal `Q` attempts to accept an invitation issued for principal `P`
- **THEN** the acceptance is rejected
- **THEN** the invitation remains pending or expired without activating any seat

### Requirement: Managed authority semantics SHALL remain adapter-owned

The shared invitation handshake SHALL NOT require all resources to share one universal permission dictionary. Each resource adapter SHALL own its own authority grammar, resolve that grammar to a native authority payload at invitation time, and persist that resolved payload as invitation truth.

#### Scenario: Terminal and room use different authority vocabularies

- **WHEN** a manager invites principal `P` to a terminal with terminal authority `RW` and to a room with room authority `member`
- **THEN** the terminal invitation stores the terminal-native authority payload
- **THEN** the room invitation stores the room-native authority payload
- **THEN** the shared handshake does not require those two payloads to be renamed into one fake canonical role

### Requirement: Managed invitation durability SHALL remain resource-owned

The shared invitation handshake SHALL NOT become a separate global mutable authority for all resource invitations. Each resource system SHALL persist, query, mutate, and revoke its own invitation facts within its own durable boundary, even when those systems reuse the same handshake helpers and proof contract.

#### Scenario: Terminal and room invitations remain in their owning systems

- **WHEN** TerminalSystem and MessageSystem both adopt the shared handshake
- **THEN** terminal invitation rows remain owned by TerminalSystem durability
- **THEN** room invitation rows remain owned by MessageSystem durability
- **THEN** the shared handshake layer does not become the single writable store for both systems

### Requirement: Managed authority proof SHALL bind to the proposed authority snapshot

If the proposed authority payload changes before acceptance, the original invitation proof or token binding MUST NOT silently activate the new authority.

#### Scenario: Changed proposed authority invalidates stale acceptance binding

- **WHEN** a manager changes the proposed authority payload after issuing an invitation
- **THEN** the old acceptance binding no longer activates the previous invitation unchanged
- **THEN** the system either replaces the invitation or otherwise forces acceptance to bind to the updated payload digest

### Requirement: Managed seat descriptors SHALL project one opaque token into shareable link forms

The platform SHALL treat the opaque invitation token as the only durable acceptance handle. Deep-link URIs and HTTP wrapper URLs SHALL be derived projections over that token so different clients can transport the same invitation without changing its authority.

#### Scenario: Invitation returns deep-link and HTTP share descriptors

- **WHEN** a manager creates a managed seat invitation
- **THEN** the response includes the opaque invitation token
- **THEN** the response can also include a canonical resource deep link and an HTTP wrapper URL derived from that same token
- **THEN** acceptance through any one of those descriptors resolves to the same invitation fact

### Requirement: Managed seat mutation SHALL invalidate stale invitation authority

Revoking a managed seat or replacing its pending invitation SHALL invalidate any older invitation tokens for that same resource and principal. Expired or revoked invitations MUST NOT be accepted later.

#### Scenario: Revoked invitation cannot be accepted

- **WHEN** a manager revokes a pending invitation before the recipient accepts it
- **THEN** later acceptance attempts with that invitation token fail
- **THEN** no active seat is created from the revoked invitation

#### Scenario: Replaced invitation rotates the accept handle

- **WHEN** a manager re-invites the same principal after changing the proposed seat class
- **THEN** the previously pending invitation is no longer valid for acceptance
- **THEN** only the newest invitation descriptor can activate the seat

#### Scenario: Renewed pending invitation refreshes expiry

- **WHEN** a manager re-invites the same principal for the same resource while the previous invitation is still pending
- **THEN** the system replaces the older pending invitation with a newer pending invitation fact
- **THEN** the newer invitation carries a fresh expiry window
- **THEN** the older descriptor no longer activates the seat even if its text still exists elsewhere

#### Scenario: Expired invitation really becomes unusable

- **WHEN** the pending invitation passes its persisted expiry boundary before acceptance completes
- **THEN** later acceptance attempts fail even if the descriptor still parses correctly
- **THEN** the system does not activate any seat from that expired descriptor

#### Scenario: Accepted seat mutation does not rotate through a fresh invitation

- **WHEN** a manager changes authority for a seat that is already accepted and active
- **THEN** the system applies that change through unilateral seat mutation rather than creating a second invitation
- **THEN** the existing seat does not require a second acceptance only because its role changed
