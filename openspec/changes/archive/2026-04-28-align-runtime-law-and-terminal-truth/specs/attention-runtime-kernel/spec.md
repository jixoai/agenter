## ADDED Requirements

### Requirement: Attention runtime SHALL describe attention as Context plus Items
The runtime attention law SHALL define AttentionSystem as an information carrier made of `Context` and committed items. `Context` SHALL represent the current cognitive snapshot, and committed items SHALL represent objective or subjective facts that can influence that snapshot. Scheduling pressure from unresolved scores is one use of this carrier, but it SHALL NOT redefine the whole system as only an unfinished-work ledger.

#### Scenario: Objective and subjective items influence the same context
- **WHEN** message ingress, terminal output, or model analysis produces attention commits for one context
- **THEN** those commits are interpreted as inputs that influence the context snapshot
- **AND** the runtime does not require every commit to be described as a user-facing TODO item

## MODIFIED Requirements

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
