## ADDED Requirements

### Requirement: Room messages SHALL preserve durable acting actor identity

The message control plane SHALL persist the canonical acting actor identity for each room message in addition to any display label, and every snapshot, page, and incremental transport payload SHALL expose that durable sender identity unchanged.

#### Scenario: Same-label actors send distinct room messages

- **WHEN** two different actors with the same visible label both send messages into one room
- **THEN** the persisted message records keep distinct canonical actor identities for each send
- **THEN** room transport consumers can distinguish those sends without inferring identity from labels

#### Scenario: Send-as authority becomes durable message fact

- **WHEN** an operator chooses a room token and sends a message as that actor
- **THEN** the resulting room message persists the selected acting actor identity
- **THEN** later snapshot or page reads preserve that identity even after refresh or reconnect
