## MODIFIED Requirements

### Requirement: Session runtime SHALL route chat through attention and message adapters

Session runtime SHALL ingest chat-channel inputs into attention and route reply items back into message-system through adapters. For chat-backed work, visible message dispatch alone MUST NOT count as completion; the related attention MUST remain unresolved until the assistant also records the settlement. When one task spans an originating room and a secondary relay room, the originating room SHALL remain the owner of completion, and the factual answer MUST remain recoverable after a manual compact cycle.

#### Scenario: A queued user message becomes read only when the load gate passes

- **WHEN** a queued chat message is invalidated for attention
- **THEN** session runtime asks LoopBus whether that source should load now
- **AND** the message is marked as read and visible only after the gate allows it

#### Scenario: Deferred queued messages survive active tool work

- **WHEN** a new queued chat message arrives while the runtime is still working on other attention
- **THEN** the message remains pending instead of being falsely marked complete
- **AND** the runtime may load it in a later eligible round through the same attention ingress gate
