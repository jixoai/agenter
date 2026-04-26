## Purpose

Define the prompt-side bootstrap contract that sits between attention-system, LoopBus plugin runtime, and model request assembly.

## Requirements

### Requirement: Attention bootstrap SHALL use a two-stage `context` + `items` protocol
The first attention-native model inputs for a round SHALL be split into a bootstrap `context` document and a delta `items` payload. `context` SHALL carry only `AttentionContexts.metadata` plus rendered bootstrap-visible attention context snapshots. `items` SHALL carry only unresolved attention deltas. If a compact summary exists, it SHALL remain an ordinary prompt-window replay message rather than a separate bootstrap input.

#### Scenario: Bootstrap context is emitted before delta items
- **WHEN** runtime collects model inputs for a round with active attention
- **THEN** it emits one bootstrap input whose protocol kind is `context`
- **AND** that input appears before any `items` input for the same round

#### Scenario: Bootstrap context stays minimal
- **WHEN** runtime assembles the bootstrap `context`
- **THEN** the context text contains `## AttentionContexts.metadata`
- **AND** bootstrap-visible rendered snapshots appear only as `## AttentionContext.<contextId>` sections in the context input
- **AND** the bootstrap does not synthesize a separate `## PreAICallContext Summary` input
- **AND** the bootstrap input does not contain `## Systems Descriptions` or grouped long-guide sections

#### Scenario: Delta items stay fact-only
- **WHEN** runtime serializes unresolved attention into the `items` payload
- **THEN** the text contains `## Attention Items`
- **AND** unresolved facts remain delta-only whether they are emitted as repeated `yaml+attention-item` blocks or one aggregated `yaml+attention_items` block
- **AND** the runtime does not pre-bake related-query expansions into that payload

### Requirement: Bootstrap SHALL include only selected or explicitly bootstrapped system surfaces
Runtime bootstrap SHALL surface only systems that participate in the current round or are explicitly published as bootstrap-visible attention contexts. Those systems SHALL appear through minimal context metadata and rendered context snapshots, not through provider-owned system guide strings.

#### Scenario: Inactive systems stay out of the bootstrap
- **WHEN** a system has neither selected attention nor a bootstrap-visible context for the current round
- **THEN** that system does not appear in the bootstrap metadata set
- **AND** no rendered `## AttentionContext.<contextId>` snapshot is emitted for it

#### Scenario: Active or bootstrapped systems surface through metadata and snapshots
- **WHEN** message attention is active and the canonical skill snapshot is bootstrap-visible for the current round
- **THEN** the bootstrap context metadata lists both the message context and `ctx-skill-system`
- **AND** the bootstrap context includes `## AttentionContext.ctx-skill-system`
- **AND** the runtime does not duplicate the same skill snapshot in `systemPrompt`

#### Scenario: Future systems extend bootstrap through attention contexts
- **WHEN** a new runtime system needs bootstrap-visible context for a round
- **THEN** it publishes an attention context or bootstrap snapshot
- **AND** runtime bootstrap can include that system without patching `agenter-ai` or reintroducing provider-owned `systemPrompt` glue

### Requirement: Cycle persistence SHALL retain bootstrap and delta refs
When a cycle persists collected attention inputs, it SHALL preserve the attention context ids and commit refs attached to those bootstrap/delta inputs so later inspection can reconstruct which facts drove the round.

#### Scenario: Persisted cycle keeps attention context refs
- **WHEN** runtime persists a cycle that consumed bootstrap and delta attention inputs
- **THEN** the persisted cycle records the collected `attentionContextIds`
- **AND** inspection can identify which attention contexts participated in that round

#### Scenario: Persisted cycle keeps delta commit refs
- **WHEN** runtime persists a cycle whose `items` payload references unresolved attention commits
- **THEN** the persisted cycle records the collected `attentionCommitRefs`
- **AND** later debugging or replay inspection can trace the round back to the originating unresolved commits

### Requirement: Attention delta payloads SHALL serialize explicit durable fields
The prompt-side attention `items` payload SHALL serialize only explicit durable fields needed by the model: provenance, scores, summary, and body/change content. It SHALL NOT dump raw metadata bags into the model payload, and it SHALL NOT carry hidden room-routing descriptors as a substitute for explicit message tools.

#### Scenario: Message attention delta includes body context without raw metadata
- **WHEN** runtime serializes an unresolved message attention commit into the `items` payload
- **THEN** the payload includes explicit provenance fields plus the rendered body/change content
- **AND** it does not include a raw `meta` object copied from runtime transport state

#### Scenario: Room-visible intent stays explicit
- **WHEN** unresolved attention implies that a room-visible correction or reply may be needed
- **THEN** the payload leaves that decision to explicit tools such as `message send`, `message edit`, or `message recall`
- **AND** the payload does not rely on `meta.replyTarget` or any hidden routing descriptor
