## Purpose

Define the compact cycle that rewrites only the bounded model prompt window while durable runtime facts continue to grow.

## Requirements

### Requirement: Compact SHALL rewrite only the bounded model prompt window

The system SHALL treat compact as a special cycle that rewrites only the model's bounded prompt window. Compact MUST NOT delete or rewrite persisted attention facts, `message_parts`, or `ai_call` ledger rows. Compact SHALL advance the prompt-window round for future model calls without shrinking persisted inspection history.

#### Scenario: Compact leaves durable facts intact while rotating bounded prompt memory

- **WHEN** compact is triggered manually or by an explicit compact-policy trigger such as threshold or context-overflow recovery
- **THEN** the runtime rewrites only the prompt-window memory used for later model calls
- **THEN** persisted attention, `message_parts`, and `ai_call` facts remain queryable and unchanged
- **THEN** later model calls use the new prompt-window round without deleting earlier request/response rows

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

### Requirement: Compact trigger law SHALL resolve from explicit compact policy

The runtime SHALL resolve automatic compact triggers from an explicit compact-policy contract instead of using a generic any-error fallback or inferring compact law from provider metadata.

#### Scenario: Timeout does not trigger compact by default

- **WHEN** a model round fails with a timeout and the compact policy does not explicitly enable timeout-triggered compact
- **THEN** the runtime records the timeout failure as recovery state
- **AND** it does not enqueue a compact cycle just because an error occurred

#### Scenario: Context overflow triggers compact through explicit recovery policy

- **WHEN** a model round fails with context overflow and the compact policy enables `context_overflow`
- **THEN** the runtime enqueues a compact cycle with the `context_overflow` trigger
- **AND** the resulting cycle is distinguishable from threshold, manual, and other recovery-driven compact cycles

### Requirement: Threshold compact SHALL belong to runtime compact policy

Prompt-window threshold compaction SHALL be configured through the runtime compact policy instead of provider metadata, while still allowing a legacy read path during migration.

#### Scenario: Legacy provider compact threshold migrates into runtime compact policy

- **WHEN** settings still define a legacy provider `compactThreshold` without an explicit runtime compact policy threshold
- **THEN** resolved runtime config uses that legacy value as a compatibility fallback
- **AND** new writes continue to target the runtime compact policy instead of provider settings
