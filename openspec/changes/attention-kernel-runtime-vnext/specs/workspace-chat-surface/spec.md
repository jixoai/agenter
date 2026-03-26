## MODIFIED Requirements

### Requirement: Chat SHALL only show user-facing assistant output
The Chat surface SHALL render user input plus message-channel deliveries intended for users, while internal attention activity, terminal summaries, and unmatched technical replies remain outside the primary transcript.

#### Scenario: Attention updates stay out of Chat
- **WHEN** the runtime commits or patches an internal attention item without a successful message egress dispatch
- **THEN** the Chat transcript does not render that update as an assistant reply
- **THEN** the activity remains available only through technical inspection surfaces

#### Scenario: Message egress becomes a visible assistant reply
- **WHEN** the runtime dispatches a committed attention item successfully through the message egress adapter into a chat channel
- **THEN** Chat renders the delivered channel message as the assistant reply
- **THEN** the visible row is anchored to the persisted channel message instead of the raw attention item

#### Scenario: Optimistic user messages deduplicate by identity
- **WHEN** an optimistic user turn and a persisted cycle share the same `clientMessageId`
- **THEN** Chat renders exactly one user message row for that turn
- **THEN** the optimistic row is replaced by the persisted one without a duplicate transcript entry
