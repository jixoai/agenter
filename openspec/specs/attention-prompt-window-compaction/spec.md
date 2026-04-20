## Purpose

Define the compact cycle that rewrites only the bounded model prompt window while durable runtime facts continue to grow.

## Requirements

### Requirement: Compact SHALL rewrite only the bounded model prompt window

The system SHALL treat compact as a special cycle that rewrites only the model's bounded prompt window. Compact MUST NOT delete or rewrite persisted attention facts or the longer-lived `message_parts` ledger. Compact SHALL rotate the retained `ai_call` round window so that only the current and immediately previous request/response rounds remain stored in full.

#### Scenario: Compact leaves durable facts intact while rotating bounded AI-call retention

- **WHEN** compact is triggered manually or by an explicit compact-policy trigger such as threshold or context-overflow recovery
- **THEN** the runtime rewrites only the prompt-window memory used for later model calls
- **THEN** persisted attention and `message_parts` facts remain queryable and unchanged
- **THEN** retained `ai_call` rows are rotated so older full request/response rounds are pruned

### Requirement: Compact SHALL run as a tool-less structured-summary cycle

The compact cycle SHALL not expose normal work tools. It SHALL consume the prior bounded prompt window, remove detailed tool-call history from that bounded memory, and produce a structured summary that preserves decisions, key files or facts, reusable ready-reply facts, unresolved work, and next steps. The resulting compact seed SHALL be persisted in the ledger without requiring a dedicated `prompt_window_state` table.

#### Scenario: Compact produces the next prompt-window seed

- **WHEN** a compact cycle completes
- **THEN** the result contains structured summary fields describing decisions, key files or facts, reusable ready-reply facts, unresolved work, and next steps
- **THEN** unresolved attention items are carried into the next prompt window alongside that summary
- **THEN** the next bounded prompt context can be reconstructed from ledger facts rather than a dedicated prompt-window snapshot table

### Requirement: Compact ready replies SHALL remain reusable after compaction

Compact summaries SHALL preserve resolved facts and unresolved work needed for later follow-up without replaying old tool dispatches back into the prompt window.

#### Scenario: Compact preserves durable facts without replay artifacts

- **WHEN** the runtime rebuilds prompt history after a compact cycle
- **THEN** it keeps the compact overview, decisions, key files, key facts, unresolved work, and next steps
- **AND** it does not re-inject `readyReplies` or other replay-only relay artifacts as prompt-window messages

#### Scenario: Delivered answers remain reusable even when they only exist in tool history

- **WHEN** the most recent settled user-visible answer was delivered through a successful `message_send` call or already recorded in a prior compact summary
- **THEN** the next compact summary promotes that delivered answer into durable compact facts
- **AND** a later matching follow-up can answer directly from compact memory without reopening the finished relay or lookup workflow

### Requirement: Automatic compact SHALL follow explicit trigger semantics

Automatic compact SHALL only occur for configured compact-policy triggers; generic `any error => compact` behavior is not allowed.

#### Scenario: Timeout failure stays in recovery path instead of compacting

- **WHEN** a model round fails because of timeout
- **AND** timeout-triggered compact is not explicitly enabled by compact policy
- **THEN** the runtime does not enqueue automatic compact
- **AND** the recovery law remains visible through retry/backoff state instead of being hidden behind compaction

#### Scenario: Policy-enabled recovery failure yields a specific compact trigger

- **WHEN** a recovery condition that is explicitly enabled by compact policy occurs
- **THEN** the runtime enqueues compact with a specific trigger token such as `context_overflow` or `attention_retry`
- **AND** the persisted cycle facts do not collapse that trigger into a generic `error`
