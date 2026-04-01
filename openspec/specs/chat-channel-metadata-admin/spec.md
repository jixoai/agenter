# chat-channel-metadata-admin Specification

## Purpose
TBD - created by archiving change chat-channel-token-admin. Update Purpose after archive.
## Requirements
### Requirement: Admin access SHALL mutate chat-channel metadata

A caller with current room-admin access SHALL be able to update mutable global room metadata, including title, room metadata fields, participant actor bindings, and the ordered room admin-group candidate list, while non-admin callers remain read-only for those concerns.

#### Scenario: Passive refresh does not discard an in-progress admin edit
- **WHEN** the metadata disclosure rerenders because the room list polled again but the durable room revision did not change
- **THEN** any unsaved title, participant, or metadata draft already entered by the admin remains intact
- **AND** the disclosure only resyncs from server truth after a real room revision change

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

