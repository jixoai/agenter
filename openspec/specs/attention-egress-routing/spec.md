# attention-egress-routing Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.
## Requirements
### Requirement: Committed attention outcomes SHALL be dispatched through typed egress adapters
The runtime SHALL route committed attention outcomes into external systems through typed egress adapters that match on item metadata and dispatch with stable attention references.

#### Scenario: A reply item is dispatched to a chat channel
- **WHEN** a committed attention item matches a message egress adapter for a chat channel
- **THEN** the runtime dispatches the reply with the channel identity, sender identity, content, and linked attention refs
- **THEN** it records a successful message egress result for that delivery

#### Scenario: A terminal effect dispatches independently of chat
- **WHEN** a committed attention item matches a terminal egress adapter and not a message egress adapter
- **THEN** the runtime dispatches the item only to the terminal system
- **THEN** no chat message is created from that item

### Requirement: Chat visibility SHALL require successful message egress
A reply SHALL appear in Chat only after a message egress adapter has accepted and successfully dispatched it into a chat channel.

#### Scenario: Internal attention stays out of Chat
- **WHEN** the runtime commits or patches an internal attention item without a successful message egress dispatch
- **THEN** the Chat transcript does not render that item as an assistant reply
- **THEN** the activity remains available only through technical inspection surfaces

#### Scenario: Failed message egress does not create a transcript row
- **WHEN** a committed attention item matches a chat adapter but dispatch fails
- **THEN** the runtime records the failed egress attempt for technical inspection
- **THEN** Chat does not render a user-visible assistant reply from that failed delivery

