## Purpose

Define the prompt-side bootstrap contract that sits between attention-system, LoopBus plugin runtime, and model request assembly.

## Requirements

### Requirement: Attention bootstrap SHALL use a two-stage `context` + `items` protocol
The first attention-native model inputs for a round SHALL be split into a bootstrap `context` document and a delta `items` payload. `context` SHALL describe the whole AI call bootstrap rather than a single-context dump, while `items` SHALL carry only unresolved attention deltas.

#### Scenario: Bootstrap context is emitted before delta items
- **WHEN** runtime collects model inputs for a round with active attention
- **THEN** it emits one bootstrap input whose protocol kind is `context`
- **AND** that input appears before any `items` input for the same round

#### Scenario: Bootstrap context carries system directory and grouped attention context facts
- **WHEN** runtime assembles the bootstrap `context`
- **THEN** the text contains `## PreAICallContext Summary`, `## Systems Descriptions`, and `## Attention Context`
- **AND** active systems render one-line descriptions in `## Systems Descriptions`
- **AND** long guides and focused/background context facts are grouped under system-specific sections inside `## Attention Context`

#### Scenario: Delta items stay fact-only
- **WHEN** runtime serializes unresolved attention into the `items` payload
- **THEN** the text contains `## Attention Items`
- **AND** unresolved facts remain delta-only whether they are emitted as repeated `yaml+attention-item` blocks or one aggregated `yaml+attention_items` block
- **AND** the runtime does not pre-bake related-query expansions into that payload

### Requirement: Bootstrap SHALL include only active system guidance
Dynamic system guidance SHALL be resolved through runtime attention guide providers and SHALL appear only for systems that are active for the current round. Systems that are not active or not enabled SHALL NOT pollute the bootstrap document.

#### Scenario: Inactive systems stay out of the bootstrap
- **WHEN** a system has no active guide contribution for the current round
- **THEN** that system does not appear in `## Systems Descriptions`
- **AND** no long guide section for that system is emitted under `## Attention Context`

#### Scenario: Active systems emit both one-line descriptions and long guides
- **WHEN** message and terminal attention are both active for the current round
- **THEN** `## Systems Descriptions` includes one-line entries for `messageSystem` and `terminalSystem`
- **AND** `## Attention Context` includes grouped long-guide sections for both systems

#### Scenario: Future systems extend bootstrap through guide providers
- **WHEN** a new runtime system needs to teach the model how to interpret its active contexts
- **THEN** it registers an `AttentionContextGuideProvider`
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
