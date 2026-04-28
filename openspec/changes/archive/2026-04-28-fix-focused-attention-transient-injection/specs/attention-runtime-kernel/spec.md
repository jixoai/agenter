## ADDED Requirements

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
