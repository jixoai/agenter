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

#### Scenario: Explicitly needed skill context can surface through metadata and snapshots
- **WHEN** message attention is active and skill content has separately become bootstrap-visible through an explicit mount, explicit query result, or already-objective task dependency for the current round
- **THEN** the bootstrap context metadata may list both the message context and the related skill context
- **AND** the bootstrap context may include the corresponding `## AttentionContext.<contextId>` snapshot
- **AND** the runtime does not duplicate the same skill snapshot in `systemPrompt`

#### Scenario: Skill refresh alone does not bootstrap a dedicated skill context
- **WHEN** runtime refreshes or reindexes visible skills without an explicit mount, explicit query, or already-objective task dependency
- **THEN** the bootstrap context does not automatically include `ctx-skill-system`
- **AND** skill refresh alone does not create a permanent bootstrap-visible skill task peer

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

### Requirement: Attention protocol inputs SHALL be current-call transient inputs

Attention bootstrap `context` and `items` payloads SHALL be assembled for the current model call and SHALL NOT be persisted as bounded prompt-window replay messages. The provider request ledger SHALL still record those payloads exactly when they are sent.

#### Scenario: Current call receives attention protocol inputs

- **WHEN** runtime collects active attention for a model call
- **THEN** the provider request includes the current `context` payload before the current `items` payload
- **AND** the persisted `ai_call.request.messages` contains the same attention protocol payloads sent to the provider

#### Scenario: Later calls do not replay old attention protocol inputs

- **WHEN** a later model call is assembled after an earlier call consumed attention protocol inputs
- **THEN** the later call does not receive the earlier `AttentionContexts.metadata` payload from prompt-window replay
- **AND** the later call does not receive the earlier `Attention Items` payload from prompt-window replay

### Requirement: Focused item injection SHALL use newly committed deltas only

The attention `items` payload SHALL directly inject item detail for newly committed focused attention deltas selected at the current collection boundary. It SHALL NOT use historical cursor catch-up to resend old commits when no model-seen cursor is available.

#### Scenario: Focused new commit is injected

- **WHEN** a focused AttentionContext receives one or more newly committed AttentionItems for the current collection boundary
- **THEN** runtime serializes those newly committed item deltas into the current `items` payload
- **AND** the model can handle the active notification without first querying the full context history

#### Scenario: Historical commits are not selected by cursor fallback

- **WHEN** a focused AttentionContext already has historical commits but no new commit delta for the current collection boundary
- **THEN** runtime may include the context's aggregate score in `AttentionContexts.metadata`
- **AND** runtime does not serialize recent historical commits merely because a `lastSeenCommitId` cursor is missing

### Requirement: Attention bootstrap SHALL follow the current-state per-context injection law

The runtime SHALL use the same current-state per-context injection law for bootstrap-visible work and ordinary interleaved work. Hard boundaries such as prompt compaction and cold restart MAY require fresh `AttentionContext` projection, but a focused context MAY also use the `AttentionContext` path during ordinary interleaved injection when that path wins the current per-context comparison. Historical `AttentionItems` replay remains forbidden unless new commit delta exists for the current collection boundary or the selected item path is an explicit notify exception.

#### Scenario: Compact boundary refreshes context projection without item replay

- **WHEN** prompt-window compaction rebuilds the model's bounded memory while active attention still exists
- **THEN** the next attention round may include fresh `AttentionContexts.metadata`
- **AND** it does not serialize historical `AttentionItems` unless new commits happen during that boundary

#### Scenario: Ordinary focused work may still choose context path

- **WHEN** a focused context participates in an ordinary interleaved collection boundary and the current-state comparison chooses the `AttentionContext` branch
- **THEN** runtime may inject that context projection even outside compact or cold-restart boundaries
- **AND** the implementation does not reserve `AttentionContext` injection only for special recovery branches

#### Scenario: Restart boundary refreshes context projection without item replay

- **WHEN** a session cold starts from persisted AttentionSystem facts
- **THEN** runtime compares/rebuilds the session-local AttentionContext projection and may inject updated context metadata/scores
- **AND** runtime does not serialize historical item detail as a new `items` notification
