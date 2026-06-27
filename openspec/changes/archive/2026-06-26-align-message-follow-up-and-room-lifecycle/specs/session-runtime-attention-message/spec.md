## MODIFIED Requirements

### Requirement: Message follow-up compatibility SHALL be owned by message-system local durability

For local room sends, `followUpAfterMs` SHALL no longer materialize as a session-runtime generic watch. It SHALL become a durable message-system follow-up task bound to the successfully written room message and later mature into attention-only re-decision work.

#### Scenario: Local send writes follow-up task with the room message

- **WHEN** a local authorized room send includes `followUpAfterMs`
- **THEN** the visible room message is persisted
- **AND** one follow-up task for that message is written in the same room durability transaction
- **AND** session-runtime does not arm a second session-local watch for the same follow-up

#### Scenario: Local restart reloads follow-up tasks from message-system

- **GIVEN** a room message already persisted a follow-up task
- **WHEN** message-system runtime starts again before the task is due
- **THEN** message-system reloads that task from room durability
- **AND** it re-arms the due timer without requiring session-runtime to restore a legacy runtime watch

### Requirement: Managed-seat remote follow-up SHALL remain deferred until cross-RPC context law exists

Managed-seat remote room sends SHALL NOT pretend to support `followUpAfterMs` through the current bridge until AsyncContext + RPC context propagation can preserve follow-up ownership correctly across authority boundaries.

#### Scenario: Remote bridge does not add ad-hoc follow-up transport state

- **WHEN** a room send goes through the current managed-seat remote authority bridge
- **THEN** the bridge only carries the explicit room mutation contract
- **AND** it does not add a bridge-local `followUpAfterMs` transport field as a substitute for cross-RPC context propagation
