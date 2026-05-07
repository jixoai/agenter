## ADDED Requirements

### Requirement: Attention CLI SHALL expose generic self-evolution loop primitives

Attention CLI SHALL let assistants and products create delayed or watched self-evolution work without adding named kernel features. Named user rituals SHALL be composed on top of generic primitives.

#### Scenario: Assistant schedules a reflection loop without core ritual
- **WHEN** a user teaches an assistant a named reflection habit such as nightly review
- **THEN** the assistant can create a generic scheduled self-evolution attention loop
- **AND** the loop records owner Avatar, reason, timing, recurrence if any, provenance, and settlement criteria
- **AND** the kernel does not add a named feature, score key, or branch for that user ritual

#### Scenario: Assistant watches a learning obligation
- **WHEN** the assistant needs to keep a learning or memory-improvement obligation alive until more evidence arrives
- **THEN** it can create a generic watched attention loop
- **AND** the loop remains queryable through attention-cli
- **AND** the loop can enter backoff or blocked state when repeated rounds make no progress

### Requirement: Self-evolution loops SHALL remain separate from hosting and terminal authority

Self-evolution loop attention SHALL schedule reflection and memory/skill work. It SHALL NOT imply managed mode, hosting score, or terminal write permission.

#### Scenario: Scheduled reflection runs while managed mode is off
- **WHEN** a scheduled self-evolution loop wakes the assistant
- **AND** cli-shell managed mode is off
- **THEN** the assistant may review memory, skills, and prior work
- **AND** it does not require `scores: {"hosting": 1000}`
- **AND** it does not gain terminal write authority unless a separate delegation or approval exists

#### Scenario: User revokes a self-evolution loop
- **WHEN** the user revokes a scheduled or watched self-evolution loop
- **THEN** attention-cli records explicit settlement or revocation provenance
- **AND** future wakeups from that loop stop
- **AND** unrelated hosting attention or delegation leases are unchanged

### Requirement: Self-evolution loops SHALL have real AI evaluation coverage

Scheduled and watched self-evolution behavior SHALL be validated with long-running real AI scenarios and semantic judge scoring because the useful result is learned behavior, not only durable rows.

#### Scenario: Long-running test proves later behavior changed correctly
- **WHEN** a real AI test schedules a self-evolution loop, forces compact or restart, and later wakes the assistant
- **THEN** the assistant updates memory or skills according to the user-taught habit
- **AND** later behavior uses that updated memory
- **AND** a semantic judge scores the learning direction, memory quality, orthogonality, and absence of fixture overfit
