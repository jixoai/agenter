# attention-runtime-kernel Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.
## Requirements
### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL normalize message, terminal, task, and future system activity into committed attention items before any cycle scheduling or model work starts. The kernel SHALL pass only attention-centric inputs into model work and SHALL NOT require chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Focused source activity becomes committed attention
- **WHEN** a message source, focused terminal source, or future system source invalidates runtime work
- **THEN** the runtime resolves that source into one or more context-bound attention drafts
- **THEN** the runtime commits those items before evaluating whether a cycle should start

#### Scenario: No committed attention delta means no cycle work
- **WHEN** all invalidated sources resolve without creating or changing any attention item
- **THEN** the runtime does not schedule a new model pass from that source activity alone
- **THEN** it does not fabricate a flattened fallback input to force a cycle

#### Scenario: Attention progress does not require legacy output arrays
- **WHEN** a model pass reduces attention debt through committed attention mutations or provider side-effects
- **THEN** the kernel treats that round as valid progress even if the processor returns no `toUser`, `terminal`, or `tools` payloads
- **THEN** projection layers derive user-visible updates from persisted facts instead of core response outputs

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

### Requirement: Runtime SHALL assemble provider-owned system guides
The runtime kernel SHALL assemble the model `systemPrompt` from shared prompt documents plus provider-owned system-guide sections contributed by active tool providers. Those guides SHALL stay in the system-prompt layer and SHALL NOT be serialized as prompt-window chat messages or synthetic runtime help inputs.

#### Scenario: Active providers contribute their own system guidance
- **WHEN** a model call is prepared with one or more active tool providers
- **THEN** the kernel collects each provider's system-guide section in provider registration order
- **AND** injects the combined result into the model `systemPrompt`

#### Scenario: Provider guidance stays out of replay history
- **WHEN** a provider contributes a system-guide section
- **THEN** the guidance is visible in the outbound model `systemPrompt`
- **AND** it does not appear as a replayed assistant or user message in the bounded prompt window

#### Scenario: Legacy templates still receive provider guidance
- **WHEN** the configured `SYSTEM_TEMPLATE` does not yet expose a `SYSTEMS_GUIDE` slot
- **THEN** the kernel still injects provider-owned guidance through a fallback placement near the core system prompt
- **AND** the guidance reaches the model without requiring synthetic runtime messages

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
