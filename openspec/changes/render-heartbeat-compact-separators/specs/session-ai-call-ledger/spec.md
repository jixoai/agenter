## MODIFIED Requirements

### Requirement: Session DB SHALL persist AI-visible traffic as grouped message parts
The session durable store SHALL persist AI-visible request and response traffic in a `message_parts` ledger. Each row SHALL belong to one logical `message_id`, SHALL record append order, role, part type, timestamps, completion state, and serialized part payload, and SHALL support streamed updates to the same logical part until it is complete. Compact cycles SHALL also persist a dedicated `scope=heartbeat` boundary message with `partType=compact` so Heartbeat can reconstruct prompt-window restart boundaries from durable facts.

#### Scenario: Compact cycle persists a heartbeat boundary fact
- **WHEN** a compact cycle completes and rotates the bounded prompt-window round
- **THEN** the runtime appends a `scope=heartbeat`, `role=system`, `partType=compact` message-part record linked to that compact AI-call
- **AND** later Heartbeat reconstruction can show the compaction boundary without inferring it from assistant prose or cycle UI state
