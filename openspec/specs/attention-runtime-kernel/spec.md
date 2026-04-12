# attention-runtime-kernel Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.

## Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL normalize message, terminal, task, workspace, and future system activity into focus-aware attention ingress records before any cycle scheduling or model work starts. Focused source activity SHALL become committed attention, non-focused source activity SHALL become push ingress, and the kernel SHALL pass only attention-centric inputs into model work without requiring chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Focused source activity becomes committed attention
- **WHEN** a message source, focused terminal source, workspace source, or future system source invalidates runtime work for a focused attention context
- **THEN** the runtime resolves that source into one or more context-bound attention commits
- **AND** the runtime commits those items before evaluating whether a cycle should start

#### Scenario: Focused terminal observations remain history unless explicitly actionable
- **WHEN** a focused terminal source emits snapshot or diff observations for model reasoning
- **THEN** the runtime may persist those observations as context-bound attention history
- **AND** those commits do not automatically remain unresolved debt unless the terminal event is explicitly scored as actionable

#### Scenario: Background source activity becomes push ingress
- **WHEN** non-focused message, terminal, or workspace activity invalidates runtime work
- **THEN** the runtime records that source activity as attention push ingress in the target context
- **AND** shell notification projections are derived from that push ingress
- **AND** the source system is not required to claim focus first

#### Scenario: No attention ingress delta means no cycle work
- **WHEN** all invalidated sources resolve without creating or changing any attention ingress
- **THEN** the runtime does not schedule a new model pass from that source activity alone
- **AND** it does not fabricate a flattened fallback input to force a cycle

#### Scenario: Attention progress does not require legacy output arrays
- **WHEN** a model pass reduces attention debt through committed attention mutations or provider side-effects
- **THEN** the kernel treats that round as valid progress even if the processor returns no `toUser`, `terminal`, or `tools` payloads
- **THEN** projection layers derive user-visible updates from persisted facts instead of core response outputs

### Requirement: Systems SHALL reinforce expected follow-up behavior through committed attention items
When a system observes a new fact or a missing follow-up that the AI must still handle, that system SHALL express the obligation through committed attention items instead of adding source-specific hidden branches to the runtime core. The owning system's skill guidance SHALL explain how the AI should interpret and resolve those items.

#### Scenario: A system splits "new fact" from "needs feedback" into separate obligations
- **WHEN** a system receives an external event and wants the AI to both understand the new fact and produce a follow-up response
- **THEN** it may commit one attention item describing the fact itself and another attention item describing the required follow-up obligation
- **AND** later model rounds can reason over those items explicitly instead of relying on a hidden source-specific callback contract

#### Scenario: Skill guidance teaches the meaning of system-shaped attention items
- **WHEN** a system introduces a typed attention item such as a reply-needed, review-needed, or retry-needed obligation
- **THEN** the corresponding system skill explains how the AI should inspect, prioritize, and settle that item type
- **AND** the runtime kernel itself remains agnostic to that source-specific workflow expectation

### Requirement: Runtime SHALL keep unresolved attention active across cycles
Unresolved attention items SHALL remain queryable and eligible for later scheduling until their score vectors are reduced to zero or they are explicitly dismissed.

#### Scenario: Partial progress keeps an item pending
- **WHEN** a model pass patches an attention item but leaves one or more score entries above zero
- **THEN** the item remains active in its attention context
- **THEN** later runtime wakes can schedule follow-up work against the same item reference

#### Scenario: Multiple contexts remain independently active
- **WHEN** different systems commit unresolved attention into different contexts
- **THEN** the runtime keeps those contexts independently queryable
- **THEN** later cycles can select work from more than one active context without flattening them into one text fact list

### Requirement: Runtime SHALL treat unresolved attention debt as an active scheduling obligation
As long as one or more attention items still have `score >= 1`, the runtime SHALL keep re-scheduling follow-up work without requiring new external input, and it SHALL not treat plain-text-only model output as semantic completion.

#### Scenario: Unresolved attention self-drives later model rounds
- **WHEN** a session has active attention debt and no new user, terminal, or task input arrives
- **THEN** the runtime self-wakes and re-collects the unresolved attention into a later model round
- **THEN** the unresolved item remains active until a later attention mutation changes its score vector or state

#### Scenario: Plain-text-only debt rounds do not fake completion
- **WHEN** a model round was triggered only by unresolved attention debt and it emits no attention append/patch mutation
- **THEN** the runtime does not treat that round as semantic completion for the unresolved item
- **THEN** raw plain-text output from that round does not become a user-visible Chat reply unless a message egress adapter later dispatches a committed attention outcome

### Requirement: Runtime SHALL keep system prompt provider-agnostic and stable
The runtime kernel SHALL assemble the model `systemPrompt` only from stable attention law, shared identity slots, and the runtime-generated `skills.list`. Tool providers and system adapters SHALL NOT inject provider-owned system guides into `systemPrompt`, and dynamic system details SHALL NOT be serialized into bootstrap help blocks.

#### Scenario: Skills list replaces injected system guides
- **WHEN** a model call is prepared with active message, terminal, workspace, and future systems
- **THEN** the outbound `systemPrompt` includes stable prompt law plus `skills.list`
- **AND** it does not embed provider-owned message, terminal, task, or workspace guide sections

#### Scenario: Active providers do not inject system guides into system prompt
- **WHEN** a model call is prepared with one or more active tool providers
- **THEN** the outbound `systemPrompt` contains only stable global prompt law plus shared slots such as avatar identity
- **AND** it does not embed message, terminal, task, or workspace system guide sections contributed by providers

#### Scenario: Legacy `SYSTEMS_GUIDE` slot stays empty
- **WHEN** the configured `SYSTEM_TEMPLATE` still exposes a `SYSTEMS_GUIDE` slot
- **THEN** runtime prompt assembly leaves that slot empty instead of reintroducing provider-owned fallback guidance
- **AND** dynamic system help must still arrive through attention bootstrap rather than `systemPrompt`

#### Scenario: Dynamic system help moves to bootstrap instead of replay history
- **WHEN** an active system contributes runtime guidance for the current round
- **THEN** that guidance is serialized in the bootstrap `context` input for the model call
- **AND** it is not stored as a synthetic assistant or user replay message inside bounded prompt history

### Requirement: Runtime SHALL treat attention metadata as the only bootstrap truth
The runtime SHALL bootstrap model rounds with `ContextSummary` and minimal `AttentionContexts.metadata` only. Rich system descriptions, source-specific summaries, and detailed attention bodies SHALL be fetched on demand through CLI/API surfaces instead of being pre-injected into the model input.

#### Scenario: Bootstrap input only carries minimal attention metadata
- **WHEN** the runtime prepares the current round inputs
- **THEN** the bootstrap input includes each active context's identifier, source system identity, focus state, and aggregate unresolved score
- **AND** it does not inline system-specific guide bullets or rich source detail text for that context

#### Scenario: AI fetches detail through CLI instead of bootstrap expansion
- **WHEN** the AI needs to inspect a message-backed, terminal-backed, or workspace-backed attention context
- **THEN** it uses runtime CLI commands to query the relevant system detail
- **AND** the runtime is not required to serialize that detail in advance into the bootstrap message

### Requirement: Runtime SHALL inject avatar identity into shared prompt docs
The runtime kernel SHALL provide the current avatar identity to shared prompt documents through prompt slots before assembling the outbound `systemPrompt`.

#### Scenario: Shared prompt docs render the current avatar name
- **WHEN** a runtime prepares a model call for avatar `jane`
- **THEN** `AGENTER_SYSTEM` renders `jane` through the `AVATAR_NAME` slot
- **AND** the outbound `systemPrompt` no longer hardcodes `agenter-ai`

#### Scenario: Prompt identity remains stable without an explicit avatar override
- **WHEN** a runtime prepares a model call without a configured avatar name
- **THEN** the shared prompt docs still render a stable default assistant identity
- **AND** the prompt assembly does not leave unresolved `AVATAR_NAME` placeholders in the final `systemPrompt`

### Requirement: Runtime SHALL treat attention body as the model-visible truth
The runtime SHALL ensure that any system detail the model needs is represented in attention body content or typed tools, not in hidden metadata side channels.

#### Scenario: Source-specific context survives payload simplification
- **WHEN** a message, terminal, or task source produces attention that needs extra context for model reasoning
- **THEN** runtime writes that context into the attention body's rendered detail content
- **AND** the model does not need hidden metadata to understand the work

### Requirement: LoopBus transport metadata SHALL remain scheduler-only
LoopBus transport metadata SHALL only carry scheduler/protocol facts needed for orchestration, persistence, or inspection. Business data and AI-relevant content SHALL NOT depend on that metadata.

#### Scenario: Attention input keeps persistence refs without content leakage
- **WHEN** runtime emits bootstrap or delta attention inputs into LoopBus
- **THEN** transport metadata may include `attentionContextIds`, `attentionCommitRefs`, or compact flags
- **AND** room social context, terminal payload detail, and other AI-visible facts remain in the body text instead of transport metadata

### Requirement: Real cold restart recovery SHALL remain consistent with persisted runtime law
The runtime kernel SHALL remain operable after a real `session.stop` / kernel restart / `session.start` boundary using persisted session, room, workspace, prompt-window, and attention facts instead of hidden in-memory source state.

#### Scenario: Restarted runtime continues the same delivered task
- **WHEN** a real-provider validation flow stops a session after a room-visible delivery, restarts the kernel, and later starts the same session again
- **THEN** the restarted runtime continues with the same session identity and durable room/workspace authority
- **AND** later user feedback can be resolved from persisted facts without relying on a hidden pre-stop runtime snapshot
