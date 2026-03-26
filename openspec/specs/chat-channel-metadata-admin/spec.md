# chat-channel-metadata-admin Specification

## Purpose
TBD - created by archiving change chat-channel-token-admin. Update Purpose after archive.
## Requirements
### Requirement: Admin access SHALL mutate chat-channel metadata
A caller with `admin` access SHALL be able to update mutable channel metadata, including title, channel metadata fields, and participant membership, while non-admin callers remain read-only for those concerns.

#### Scenario: Admin updates title and participants
- **WHEN** an admin updates a channel title or participant list
- **THEN** the channel metadata is persisted for subsequent snapshot and list reads
- **THEN** connected clients observe the updated metadata through the shared channel surface

#### Scenario: Member cannot mutate metadata
- **WHEN** a caller with `member` access attempts to update title or participant membership
- **THEN** the control plane rejects the request
- **THEN** existing channel metadata remains unchanged

### Requirement: Admin access SHALL issue and revoke channel tokens
A caller with `admin` access SHALL be able to issue additional channel tokens for `admin`, `member`, or `readonly` access and revoke previously issued tokens.

#### Scenario: Admin issues a readonly token
- **WHEN** an admin requests a new `readonly` grant for a channel participant or external client
- **THEN** the control plane returns a new opaque token scoped to that channel and role
- **THEN** the token can be used immediately by channel-scoped APIs and transport

#### Scenario: Revoked token loses access
- **WHEN** an admin revokes a previously issued channel token
- **THEN** subsequent API or transport requests using that token are rejected
- **THEN** the revoked grant no longer appears in channel admin listings

