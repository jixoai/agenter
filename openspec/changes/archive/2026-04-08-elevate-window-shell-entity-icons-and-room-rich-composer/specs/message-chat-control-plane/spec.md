## ADDED Requirements

### Requirement: Global room messages SHALL persist attachment references from room-owned assets
The global room message control plane SHALL allow room text messages to reference previously uploaded room-owned asset identifiers. When a room message is sent with authorized room asset ids, the persisted room message record MUST expose the corresponding attachment metadata through snapshot, page, and incremental transport reads.

#### Scenario: Room send stores attachment references
- **WHEN** an authorized caller sends a global room message with one or more uploaded room asset identifiers
- **THEN** the stored room message includes those attachment references
- **THEN** later room snapshot, page, and transport reads expose the same attachment metadata for transcript rendering

#### Scenario: Room attachment history survives reconnect
- **WHEN** a client reconnects to a room that already contains messages with room-owned attachments
- **THEN** the control plane still returns those attachment references with the durable room history
- **THEN** the client does not need a running session runtime to reconstruct the room attachment timeline
