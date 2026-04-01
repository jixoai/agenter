## Purpose

Define how external systems feed attention into LoopBus through source adapters.
## Requirements
### Requirement: Attention ingestion SHALL be sourced through source adapters
Message-system, terminal-system, and future systems SHALL integrate with the attention kernel by invalidating source references that source adapters resolve into context-bound attention drafts, not into flattened LoopBus text facts.

#### Scenario: Message invalidation becomes attention input
- **WHEN** a message channel configured for attention receives a committed message
- **THEN** the message source plugin invalidates its source reference
- **THEN** the runtime reads that source into one or more attention drafts bound to the channel context before any cycle scheduling occurs

#### Scenario: Focused terminal invalidation becomes attention input
- **WHEN** a focused terminal produces a semantic change
- **THEN** the terminal source plugin invalidates that terminal source reference
- **THEN** the runtime reads that source into attention drafts bound to the terminal context instead of synthesizing a generic text fact

#### Scenario: Terminal focused by another actor does not become this runtime's attention input
- **WHEN** a terminal produces a semantic change but only some other actor seat focuses it
- **THEN** terminal-system still records that focus truth
- **THEN** this session runtime does not ingest that terminal attention solely from the other actor's focus

#### Scenario: Future systems reuse the same invalidation protocol
- **WHEN** a future system such as browser-system or os-system participates in runtime orchestration
- **THEN** it invalidates a source reference through the shared adapter contract
- **THEN** the runtime resolves that source into structured attention drafts without adding new session-runtime private queues

### Requirement: Attention commits SHALL remain the cycle gate
The runtime SHALL decide whether to schedule model work only after attention drafts have been transformed and committed, and only when the resulting committed graph changed the active attention state.

#### Scenario: No committed attention delta means no new cycle
- **WHEN** source reads complete without producing any new or changed attention item
- **THEN** the runtime does not start a new cycle from that source activity alone
- **THEN** it leaves the scheduler idle until a real attention delta appears

#### Scenario: Cycle gating can still defer work
- **WHEN** attention drafts are committed but a cycle policy hook defers the next model pass
- **THEN** the runtime records the pending attention state and item references
- **THEN** the model call is delayed until the policy allows it
