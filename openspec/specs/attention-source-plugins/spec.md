## Purpose

Define how external systems feed attention into LoopBus through source adapters.

## Requirements

### Requirement: Attention ingestion SHALL be sourced through source adapters
Message-system, terminal-system, and future systems SHALL integrate with LoopBus by invalidating source references that are resolved by source adapters into attention drafts.

#### Scenario: Message invalidation becomes attention input
- **WHEN** a message channel configured for attention receives a committed message
- **THEN** the message source plugin invalidates its source reference
- **THEN** LoopBus reads that source and commits the resulting attention draft before deciding whether to start a cycle

#### Scenario: Focused terminal invalidation becomes attention input
- **WHEN** a focused terminal produces a semantic change
- **THEN** the terminal source plugin invalidates that terminal source reference
- **THEN** LoopBus reads the terminal source and commits the resulting attention draft before deciding whether to start a cycle

### Requirement: Attention commits SHALL remain the cycle gate
The runtime SHALL decide whether to start a cycle only after attention drafts have been transformed and committed, rather than letting external systems bypass attention and request model work directly.

#### Scenario: No committed attention delta means no new cycle
- **WHEN** source reads complete without producing any new attention draft
- **THEN** LoopBus does not start a new cycle from that source activity alone

#### Scenario: Cycle gating can still defer work
- **WHEN** attention drafts are committed but a cycle policy hook defers the next cycle
- **THEN** the runtime records the pending attention state
- **THEN** the model call is delayed until the policy allows it
