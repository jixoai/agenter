## Purpose

Define the compact cycle that rewrites only the bounded model prompt window while durable runtime facts continue to grow.

## Requirements

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

Compact summaries SHALL preserve resolved facts and unresolved work needed for later follow-up without replaying old tool dispatches back into the prompt window.

#### Scenario: Compact preserves durable facts without replay artifacts

- **WHEN** the runtime rebuilds prompt history after a compact cycle
- **THEN** it keeps the compact overview, decisions, key files, key facts, unresolved work, and next steps
- **AND** it does not re-inject `readyReplies` or other replay-only relay artifacts as prompt-window messages
