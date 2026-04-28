# attention-runtime-kernel Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.

## Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model

The runtime SHALL host a standalone LoopBus kernel that normalizes adapter-supplied system ingress into focus-aware attention ingress records before any cycle scheduling or model work starts. Focused source activity SHALL become committed attention, non-focused source activity SHALL become push ingress, and the kernel SHALL pass only attention-centric inputs into model work without requiring chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Session host boots the standalone kernel and its adapters
- **WHEN** a session runtime starts
- **THEN** it creates one standalone LoopBus kernel and mounts the configured system adapters around it
- **AND** the runtime host remains responsible for persistence and publication instead of re-implementing kernel law inline

#### Scenario: Focused source activity becomes committed attention through an adapter
- **WHEN** a message source, focused terminal source, workspace source, or future system source invalidates runtime work for a focused attention context
- **THEN** the responsible adapter resolves that source into one or more neutral ingress envelopes
- **AND** the kernel turns those envelopes into context-bound attention commits before evaluating whether a cycle should start

#### Scenario: Focused terminal observations remain history unless explicitly actionable
- **WHEN** a focused terminal source emits snapshot or diff observations for model reasoning
- **THEN** the terminal adapter may publish those observations as context-bound attention history
- **AND** those commits do not automatically remain unresolved debt unless the terminal event is explicitly scored as actionable

#### Scenario: Background source activity becomes push ingress through an adapter
- **WHEN** non-focused message, terminal, or workspace activity invalidates runtime work
- **THEN** the responsible adapter records that source activity as attention push ingress in the target context
- **AND** shell notification projections are derived from that push ingress
- **AND** the source system is not required to claim focus first

#### Scenario: No attention ingress delta means no cycle work
- **WHEN** all invalidated adapter inputs resolve without creating or changing any attention ingress
- **THEN** the kernel does not schedule a new model pass from that source activity alone
- **AND** it does not fabricate a flattened fallback input to force a cycle

#### Scenario: Attention progress does not require legacy output arrays
- **WHEN** a model pass reduces attention debt through committed attention mutations or provider side-effects
- **THEN** the kernel treats that round as valid progress even if the processor returns no `toUser`, `terminal`, or `tools` payloads
- **AND** projection layers derive user-visible updates from persisted facts instead of core response outputs

#### Scenario: Tool-result boundaries commit interleaved inputs through one API
- **WHEN** a provider tool-result boundary creates an opportunity to include newly arrived user, message, terminal, task, or plugin facts in the same model loop
- **THEN** hooks receive an explicit context with a commit API such as `ctx.commitAttentionItems()`
- **AND** hooks do not return model messages or attention payloads as a side channel
- **AND** the commit API drains source adapters, commits AttentionSystem items, updates source consume/read-ack truth, records trace facts, and stages the model-facing projection as one boundary
- **AND** the synchronous provider loop strategy only consumes the staged projection for the next continuation request

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
- **THEN** raw plain-text output from that round does not become a user-visible Chat reply unless the assistant performs an explicit room mutation such as `message send`, `message edit`, or `message recall`

### Requirement: Runtime SHALL keep system prompt provider-agnostic and stable

The runtime kernel SHALL assemble the model `systemPrompt` only from stable attention law and shared identity slots. The runtime-generated `skills.list` SHALL travel through the attention-backed bootstrap context as a readonly slot instead of being concatenated into `systemPrompt`. Tool providers and system adapters SHALL NOT inject provider-owned system guides into `systemPrompt`, and dynamic system details SHALL NOT be serialized into bootstrap help blocks.

#### Scenario: Skills list moves to the attention bootstrap context
- **WHEN** a model call is prepared with active message, terminal, workspace, and future systems
- **THEN** the outbound `systemPrompt` includes only stable prompt law plus shared identity slots
- **AND** the readonly attention context slot for `skills.list` carries the runtime-generated skill snapshot
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

The runtime SHALL bootstrap model rounds with minimal `AttentionContexts.metadata` only. Rich system descriptions, source-specific summaries, and detailed attention bodies SHALL be fetched on demand through CLI/API surfaces instead of being pre-injected into the model input. Compact summary, when present, remains prompt-window memory rather than a bootstrap document.

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

### Requirement: Runtime guidance SHALL teach ordinary-user delivery and resource recovery

The runtime SHALL provide shared prompt law plus attention-backed dynamic system guidance that is strong enough for ordinary-user requests. That guidance SHALL help the model translate vague intent into delivery work, recover missing runtime resources through tools, and coordinate clearly in shared rooms without needing scripted user instructions.

#### Scenario: Message guidance keeps replies plain and outcome-oriented for non-technical users
- **WHEN** a user asks for software help in ordinary language
- **THEN** runtime guidance helps the model acknowledge the work, keep the user informed in plain language, and report concrete outcomes instead of pushing implementation details back onto the user

#### Scenario: Terminal guidance teaches self-service recovery
- **WHEN** software delivery work requires a terminal and no live terminal context is immediately available
- **THEN** runtime guidance teaches the model to create a terminal if missing, or recover context through terminal inspection tools if one already exists
- **AND** the model does not need the user to script that recovery sequence explicitly

#### Scenario: Workspace guidance teaches real on-disk delivery
- **WHEN** the model is preparing files for delivery inside a granted workspace
- **THEN** runtime guidance teaches it to treat the mounted workspace as the real project area, write files there, and verify delivery from workspace truth
- **AND** room chat is not treated as a substitute for writing real files to disk

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

### Requirement: Focus transitions SHALL not replay historical attention items

Changing an AttentionContext focus state SHALL update the durable context projection and scheduling eligibility, but SHALL NOT by itself inject historical AttentionItems into the model request. Outstanding obligations SHALL remain visible through context scores and queryable through attention CLI/API.

#### Scenario: Focus switch back to focused does not replay history

- **WHEN** an AttentionContext with historical active commits moves from `background` or `muted` back to `focused`
- **THEN** runtime updates the context focus state and aggregate score projection
- **AND** runtime does not serialize the historical commits into an `items` payload unless they are newly committed deltas for the current boundary

#### Scenario: Scores remain the projection of outstanding work

- **WHEN** the model receives `AttentionContexts.metadata` for a context that has outstanding historical work
- **THEN** the metadata exposes the context id, focus state, and aggregate unresolved score
- **AND** the model can use attention CLI/API to inspect historical item detail when needed

### Requirement: Focused commits SHALL actively notify through item deltas

Focused AttentionContext commits SHALL remain an active notification path. When new focused item deltas are committed for the current boundary, runtime SHALL inject those item deltas into the current model call instead of requiring the model to infer new work from context scores alone.

#### Scenario: New focused commit interrupts current work

- **WHEN** a focused context commits a new scored AttentionItem while the runtime is preparing or continuing a model call
- **THEN** runtime stages that new item delta for direct model injection
- **AND** the model receives enough item detail to notice the new obligation without fetching the entire AttentionContext

### Requirement: AI-authored attention commits SHALL not become item reminders

When the model updates attention through the runtime-local attention commit tool, that commit SHALL mutate durable AttentionContext facts and scores without being staged back to the model as a new `AttentionItems` reminder.

#### Scenario: Model settles attention without self-replay

- **WHEN** the model calls `attention commit` to reduce or update scores for a context
- **THEN** runtime persists the commit and updates the context projection
- **AND** runtime does not mark that commit as an incoming item delta for a later model request

### Requirement: Attention runtime SHALL describe attention as Context plus Items

The runtime attention law SHALL define AttentionSystem as an information carrier made of `Context` and committed items. `Context` SHALL represent the current cognitive snapshot, and committed items SHALL represent objective or subjective facts that can influence that snapshot. Scheduling pressure from unresolved scores is one use of this carrier, but it SHALL NOT redefine the whole system as only an unfinished-work ledger.

#### Scenario: Objective and subjective items influence the same context
- **WHEN** message ingress, terminal output, or model analysis produces attention commits for one context
- **THEN** those commits are interpreted as inputs that influence the context snapshot
- **AND** the runtime does not require every commit to be described as a user-facing TODO item

### Requirement: Eligible message follow-up reminders SHALL mature into committed attention

When a message-bound follow-up reminder reaches due time and its anchor message is still eligible, the runtime SHALL create one committed attention item in the corresponding room context. That committed attention SHALL reference the originating `chatId` and anchor `messageId` so the AI can decide whether silence or slow progress warrants another visible room reply.

#### Scenario: Due reminder creates one follow-up decision obligation

- **WHEN** a sent room message armed `followUpAfterMs`
- **AND** that anchored message is still the latest visible room message when the due time arrives
- **THEN** the runtime commits one follow-up attention item for the same room context
- **AND** that attention item references the anchored `messageId` so later model work can judge the next reply from room context

#### Scenario: Stale anchored reminders do not create new debt

- **WHEN** a message-bound reminder reaches due time after the room has already moved on to a newer visible message
- **THEN** the runtime does not commit a new follow-up attention item from that stale reminder
- **AND** newer room activity remains the only live source of room debt

#### Scenario: Reminder expiry never auto-sends a room message

- **WHEN** a message follow-up reminder reaches due time
- **THEN** the runtime does not append a visible room message from the reminder alone
- **AND** any later room reply still requires an explicit `message send`, `message edit`, or `message recall`

#### Scenario: Reminder fires at most once

- **WHEN** a message follow-up reminder has already committed its due attention item or has already been suppressed as stale
- **THEN** the runtime does not re-arm or re-commit that same reminder automatically
- **AND** a later reminder requires a new explicit message send
