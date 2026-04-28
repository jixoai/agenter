## ADDED Requirements

### Requirement: Compact SHALL not rehydrate transient attention protocol history
Prompt-window compaction SHALL operate only on bounded prompt memory. It SHALL NOT recover old attention bootstrap `context` or `items` payloads from `ai_call` request history and insert them into the compact seed.

#### Scenario: Compact summary excludes old protocol payloads
- **WHEN** a compact cycle summarizes prior prompt-window memory after calls that included transient attention protocol inputs
- **THEN** the compact seed may preserve durable decisions, unresolved work, and next steps
- **AND** it does not copy old `AttentionContexts.metadata` or `Attention Items` payloads from prior provider requests into the next prompt window

#### Scenario: Durable attention remains queryable after compaction
- **WHEN** old attention item details are needed after compaction
- **THEN** they remain available through persisted attention facts and attention CLI/API
- **AND** they are not resurrected as prompt-window replay messages

### Requirement: Compact boundary SHALL request fresh AttentionContext projection
After compaction, runtime SHALL treat the next model-facing attention round as a boundary where `AttentionContext` projection may need to be refreshed. This boundary refresh SHALL use context metadata/scores/snapshots and SHALL NOT use historical item replay.

#### Scenario: Post-compact attention starts from context projection
- **WHEN** compaction succeeds while unresolved attention contexts remain
- **THEN** runtime schedules a fresh attention boundary
- **AND** the fresh boundary includes context projection rather than old item payload history
