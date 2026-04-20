## REMOVED Requirements

### Requirement: Committed attention outcomes SHALL be dispatched through typed egress adapters

**Reason**: Room-visible output is no longer driven from attention commit payloads. The automatic `message_reply` routing path is being removed to keep attention durability and room durability orthogonal.

**Migration**: Keep attention commits internal to attention durability and use explicit message-system mutations for all room-visible send/edit/recall behavior.

### Requirement: Typed egress descriptors SHALL drive external routing

**Reason**: The runtime is no longer allowed to infer or execute room-visible routing from attention commit descriptors.

**Migration**: Remove room-routing descriptors from public attention commit schema. If a model needs to speak in a room, it must later invoke the relevant message-system action explicitly.

### Requirement: Chat visibility SHALL require successful message egress

**Reason**: Chat visibility is no longer modeled as a consequence of attention egress. A visible room message now exists only because the model performed an explicit message-system mutation.

**Migration**: Treat attention and chat as separate facts. Query attention for internal reasoning/debugging, and query message-system for visible room truth.

## ADDED Requirements

### Requirement: Attention commits SHALL remain internal unless a later explicit mutation targets another system

Committed attention items SHALL remain internal attention facts. The public attention commit schema MUST NOT expose room-message routing fields, and attention persistence alone MUST NOT create or revise a visible room transcript row.

#### Scenario: Attention commit without message mutation stays out of room transcript

- **WHEN** the runtime persists or updates an attention commit
- **THEN** no visible room message is created from that commit alone
- **THEN** operators inspect that work through attention views rather than through synthetic chat rows

#### Scenario: Room debugging reads attention instead of message anchors

- **WHEN** an engineer needs to understand why the assistant repeated or reprocessed work
- **THEN** the system exposes that causal trail through attention history and related runtime traces
- **AND** the room message schema does not need a hidden runtime anchor field to support that investigation
