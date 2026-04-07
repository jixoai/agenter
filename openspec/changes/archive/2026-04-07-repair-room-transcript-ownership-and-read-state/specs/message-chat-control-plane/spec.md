## MODIFIED Requirements

### Requirement: Global room messages SHALL persist explicit sender identity

The global room send path SHALL accept an explicit actor identity chosen by the operator and SHALL persist that identity as `senderActorId` only when it is valid for the credential used by the caller.

#### Scenario: View-as send persists the chosen actor
- **WHEN** the operator sends a room message while viewing the room as `session:jane`
- **AND** the credential used for the send belongs to `session:jane`
- **THEN** the stored message persists `senderActorId = session:jane`
- **THEN** room snapshots and pages return the same sender identity for transcript rendering

#### Scenario: Invalid send-as actor is rejected
- **WHEN** the operator attempts to send a room message with `sendAsActorId = auth:alice`
- **AND** the credential used for the send does not belong to `auth:alice`
- **THEN** the control plane rejects the send instead of inferring another sender
