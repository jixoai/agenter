## MODIFIED Requirements

### Requirement: Attention ingestion SHALL be sourced through source adapters

Message-system, terminal-system, and future systems SHALL integrate with the attention kernel by invalidating source references that source adapters resolve into context-bound attention drafts, not into flattened LoopBus text facts.

#### Scenario: Focused terminal invalidation becomes attention input for the current session actor
- **WHEN** a terminal produces a semantic change and that terminal is focused by the current session actor
- **THEN** the terminal source plugin invalidates that terminal source reference for that runtime
- **THEN** the runtime reads that source into terminal attention drafts

#### Scenario: Terminal focused by another actor does not become this runtime's attention input
- **WHEN** a terminal produces a semantic change but only some other actor seat focuses it
- **THEN** terminal-system still records the focus truth
- **THEN** this session runtime does not ingest that terminal attention solely from the other actor's focus
