## ADDED Requirements

### Requirement: Compact SHALL rewrite only the bounded model prompt window
The system SHALL treat compact as a special cycle that rewrites only the model's bounded prompt window. Compact MUST NOT delete or rewrite persisted attention, message, tool, or cycle facts.

#### Scenario: Compact leaves persisted facts intact
- **WHEN** compact is triggered manually, by threshold, or by recovery logic
- **THEN** the runtime rewrites only the prompt-window memory used for later model calls
- **THEN** persisted session, attention, tool, and cycle facts remain queryable and unchanged

### Requirement: Compact SHALL run as a tool-less structured-summary cycle
The compact cycle SHALL not expose normal work tools. It SHALL consume the prior prompt window, remove detailed tool-call history from that bounded memory, and produce a structured summary that preserves decisions, key files or facts, reusable ready-reply facts, unresolved work, and next steps.

#### Scenario: Compact produces the next prompt-window seed
- **WHEN** a compact cycle completes
- **THEN** the result contains structured summary fields describing decisions, key files or facts, reusable ready-reply facts, unresolved work, and next steps
- **THEN** unresolved attention items are carried into the next prompt window alongside that summary

### Requirement: Compact ready replies SHALL remain reusable after compaction
Compact summaries SHALL preserve resolved cross-room or chat-backed answers as structured ready-reply facts so a later follow-up can answer directly without reopening the resolved relay.

#### Scenario: Follow-up reuses a compacted relay answer
- **WHEN** compacted memory contains a ready-reply fact whose `topic` or `triggerPhrases` match a later follow-up
- **THEN** the next normal model round can directly dispatch that fact's `reply` to that fact's `channelId`
- **THEN** it does not need to reopen the old relay before settling the new attention item
