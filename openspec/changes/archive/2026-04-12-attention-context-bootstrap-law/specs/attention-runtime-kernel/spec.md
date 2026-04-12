## RENAMED Requirements

- FROM: `### Requirement: Runtime SHALL assemble provider-owned system guides`
- TO: `### Requirement: Runtime SHALL keep system prompt provider-agnostic and stable`

## MODIFIED Requirements

### Requirement: Runtime SHALL keep system prompt provider-agnostic and stable
The runtime kernel SHALL assemble the model `systemPrompt` only from stable global prompt documents and shared identity slots. Tool providers and system adapters SHALL NOT inject provider-owned system guides into `systemPrompt`; dynamic system help SHALL instead enter the attention bootstrap context for that round.

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
