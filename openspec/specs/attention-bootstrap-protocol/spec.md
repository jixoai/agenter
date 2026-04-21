## Purpose

Define the prompt-side bootstrap contract that sits between attention-system, LoopBus plugin runtime, and model request assembly.

## Requirements

### Requirement: Attention bootstrap SHALL use a three-stage `summary` + `context` + `items` protocol
The first attention-native model inputs for a round SHALL be split into a bootstrap `summary` document, a bootstrap `context` document, and a delta `items` payload. `summary` SHALL carry only the minimal pre-call round summary. `context` SHALL carry only `AttentionContexts.metadata` plus rendered bootstrap-visible attention context snapshots. `items` SHALL carry only unresolved attention deltas.

#### Scenario: Bootstrap summary and context are emitted before delta items
- **WHEN** runtime collects model inputs for a round with active attention
- **THEN** it emits one bootstrap input whose protocol kind is `summary`
- **AND** it emits one bootstrap input whose protocol kind is `context`
- **AND** those inputs appear in `summary -> context -> items` order for the same round

#### Scenario: Bootstrap summary and context stay minimal
- **WHEN** runtime assembles the bootstrap `summary` and `context`
- **THEN** the summary text contains `## PreAICallContext Summary`
- **AND** the context text contains `## AttentionContexts.metadata`
- **AND** bootstrap-visible rendered snapshots appear only as `## AttentionContext.<contextId>` sections in the context input
- **AND** neither bootstrap input contains `## Systems Descriptions` or grouped long-guide sections

#### Scenario: Delta items stay fact-only
- **WHEN** runtime serializes unresolved attention into the `items` payload
- **THEN** the text contains `## Attention Items`
- **AND** unresolved facts remain delta-only whether they are emitted as repeated `yaml+attention-item` blocks or one aggregated `yaml+attention_items` block
- **AND** the runtime does not pre-bake related-query expansions into that payload

### Requirement: Bootstrap SHALL include only selected or explicitly bootstrapped system surfaces
Runtime bootstrap SHALL surface only systems that participate in the current round or are explicitly published as bootstrap-visible attention contexts. Those systems SHALL appear through minimal summary facts and rendered context snapshots, not through provider-owned system guide strings.

#### Scenario: Inactive systems stay out of the bootstrap
- **WHEN** a system has neither selected attention nor a bootstrap-visible context for the current round
- **THEN** that system does not appear in the bootstrap summary `activeSystems`
- **AND** no rendered `## AttentionContext.<contextId>` snapshot is emitted for it

#### Scenario: Active or bootstrapped systems surface through summary and snapshots
- **WHEN** message attention is active and the canonical skill snapshot is bootstrap-visible for the current round
- **THEN** the bootstrap summary lists `message` and `skill` in `activeSystems`
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
The prompt-side attention `items` payload SHALL serialize only explicit durable fields needed by the model: provenance, scores, summary, body/change, and typed egress descriptors when present. It SHALL NOT dump raw metadata bags into the model payload.

#### Scenario: Message attention delta includes body context without raw metadata
- **WHEN** runtime serializes an unresolved message attention commit into the `items` payload
- **THEN** the payload includes explicit provenance fields plus the rendered body/change content
- **AND** it does not include a raw `meta` object copied from runtime transport state

#### Scenario: Routing intent is serialized as typed egress
- **WHEN** an unresolved attention commit carries message reply intent
- **THEN** the payload exposes that intent through an explicit typed `egress` field
- **AND** the payload does not rely on `meta.replyTarget`
