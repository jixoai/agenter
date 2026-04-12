## MODIFIED Requirements

### Requirement: Runtime SHALL keep system prompt provider-agnostic and stable
The runtime kernel SHALL assemble the model `systemPrompt` only from stable attention law and shared identity slots plus the runtime-generated `skills.list`. Tool providers and system adapters SHALL NOT inject provider-owned system guides into `systemPrompt`, and dynamic system details SHALL NOT be serialized into bootstrap help blocks.

#### Scenario: Skills list replaces injected system guides
- **WHEN** a model call is prepared with active message, terminal, workspace, and future systems
- **THEN** the outbound `systemPrompt` includes stable prompt law plus `skills.list`
- **AND** it does not embed provider-owned message, terminal, task, or workspace guide sections

#### Scenario: Legacy `SYSTEMS_GUIDE` slot stays empty
- **WHEN** the configured `SYSTEM_TEMPLATE` still exposes a `SYSTEMS_GUIDE` slot
- **THEN** runtime prompt assembly leaves that slot empty
- **AND** system discovery happens through `skills.list` and CLI expansion instead

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
