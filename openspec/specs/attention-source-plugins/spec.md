## Purpose

Define how external systems feed attention into LoopBus through source adapters.
## Requirements
### Requirement: Attention ingestion SHALL be sourced through source adapters
Message-system, terminal-system, and future systems SHALL integrate with the attention kernel by invalidating protocol-native `src` addresses through registered source namespaces. Source adapters SHALL resolve those registered addresses into context-bound attention drafts, not into flattened LoopBus text facts or generic metadata bags.

#### Scenario: Message invalidation uses a protocol-native room message source
- **WHEN** a message channel configured for attention receives a committed message
- **THEN** the message source plugin invalidates a `src` address such as `msg:<chatId>/<messageId>`
- **AND** runtime resolves that `src` through the registered `msg` namespace before reading attention drafts
- **AND** runtime does not rely on a generic source metadata bag to look the message up again

#### Scenario: Focused terminal invalidation becomes attention input
- **WHEN** a focused terminal produces a semantic change
- **THEN** the terminal source plugin invalidates a `src` address owned by the `tty` namespace
- **THEN** the runtime resolves that source into attention drafts bound to the terminal context instead of synthesizing a generic text fact

#### Scenario: Terminal focused by another actor does not become this runtime's attention input
- **WHEN** a terminal produces a semantic change but only some other actor seat focuses it
- **THEN** terminal-system still records that focus truth
- **THEN** this session runtime does not ingest that terminal attention solely from the other actor's focus

#### Scenario: Future systems reuse the same invalidation protocol
- **WHEN** a future system such as browser-system or os-system participates in runtime orchestration
- **THEN** it registers a source namespace and invalidates protocol-native `src` addresses through the shared registry contract
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

### Requirement: Source adapters SHALL emit typed attention draft fields
Source adapters SHALL provide typed draft presentation, provenance, and semantic identity fields instead of relying on open metadata bags for model-facing information. If a source expects a visible effect in another system, that expectation SHALL be represented as model-visible attention content plus system skill guidance, and the effect SHALL still require an explicit system mutation.

#### Scenario: Message source builds a presentation body from message truth
- **WHEN** a message source is resolved into attention
- **THEN** the draft contains typed presentation fields derived from the message-system truth
- **AND** the draft does not require a later raw metadata dump to reconstruct the model-facing envelope

#### Scenario: Terminal semantic identity is preserved without generic metadata dumping
- **WHEN** a terminal source emits attention for a semantic change
- **THEN** the draft can still carry semantic identity hints for dedupe/backoff
- **AND** those hints are stored in typed draft fields rather than an open metadata bag that later leaks into commits or prompt payloads

#### Scenario: Task source facts stay in the draft body instead of the source ref
- **WHEN** a task source emits attention about a changed task file or heartbeat
- **THEN** any AI-visible source/path/file facts are represented in the draft content or presentation body
- **AND** the source ref itself remains limited to typed scheduler coordinates
