## MODIFIED Requirements

### Requirement: Compact ready replies SHALL remain reusable after compaction

Compact summaries SHALL preserve resolved facts and unresolved work needed for later follow-up without replaying old tool dispatches back into the prompt window.

#### Scenario: Compact preserves durable facts without replay artifacts

- **WHEN** the runtime rebuilds prompt history after a compact cycle
- **THEN** it keeps the compact overview, decisions, key files, key facts, unresolved work, and next steps
- **AND** it does not re-inject `readyReplies` or other replay-only relay artifacts as prompt-window messages
