## MODIFIED Requirements

### Requirement: Attention ingestion SHALL be sourced through source adapters
Message-system, terminal-system, and future systems SHALL integrate with the attention kernel by invalidating typed source references that source adapters resolve into context-bound attention drafts, not into flattened LoopBus text facts or generic metadata bags.

#### Scenario: Message invalidation uses typed room coordinates
- **WHEN** a message channel configured for attention receives a committed message
- **THEN** the message source plugin invalidates a typed source ref containing the channel identity plus message subject identity
- **AND** runtime does not rely on a generic source metadata bag to look the message up again

### Requirement: Source adapters SHALL emit typed attention draft fields
Source adapters SHALL provide typed draft presentation, provenance, semantic identity, and egress intent fields instead of relying on open metadata bags for model-facing information or source-ref side channels.

#### Scenario: Task source facts stay in the draft body instead of the source ref
- **WHEN** a task source emits attention about a changed task file or heartbeat
- **THEN** any AI-visible source/path/file facts are represented in the draft content or presentation body
- **AND** the source ref itself remains limited to typed scheduler coordinates
