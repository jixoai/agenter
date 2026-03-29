## REMOVED Requirements

### Requirement: Assistant history replay preserves factual message boundaries
**Reason**: Core model memory is no longer defined as assistant chat replay.
**Migration**: Read `promptWindow` as the model-memory projection and use persisted message or attention facts as the canonical history.

### Requirement: Tool activity remains raw structured content
**Reason**: Compact cycles intentionally remove detailed tool-call content from the model prompt window.
**Migration**: Inspect persisted tool traces, cycle facts, or attention facts for raw tool activity; treat the prompt window as a bounded working memory, not canonical tool history.

### Requirement: Assistant history ordering matches runtime fact ordering
**Reason**: Prompt-window reconstruction may summarize or omit completed detail after compaction.
**Migration**: Use persisted cycle, message, and attention facts when strict historical ordering matters.

## ADDED Requirements

### Requirement: Prompt window preserves factual attention evidence
The system SHALL build the model prompt window from attention-centric factual records instead of synthetic assistant chat messages or task-stage summaries.

#### Scenario: Uncompacted prompt window reuses factual evidence
- **WHEN** a later model round is prepared before compaction
- **THEN** the prompt window reuses factual message, attention, and tool evidence without synthetic chat headings
- **THEN** projection-only UI labels are not written into the prompt window

### Requirement: Prompt window compaction replaces detailed memory with structured summary
The system SHALL allow completed prompt-window detail to be replaced by a structured compact summary while canonical session facts remain unchanged.

#### Scenario: Compact summary replaces prior prompt-window detail
- **WHEN** a compact cycle completes successfully
- **THEN** the next prompt window starts from the structured compact summary plus unresolved attention
- **THEN** completed prompt-window detail is removed from the bounded model memory without deleting persisted facts

### Requirement: Prompt window remembers reusable replies as structured facts
The system SHALL preserve reusable user-visible answers after compaction as structured prompt-window facts instead of bare prose strings.

#### Scenario: Ready replies carry routing and matching hints
- **WHEN** a compact cycle preserves a resolved reply for later reuse
- **THEN** the prompt window stores that reply with its destination channel plus semantic matching hints such as topic or trigger phrases
- **THEN** a later model round can reuse that fact without replaying the original tool trace
