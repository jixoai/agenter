## MODIFIED Requirements

### Requirement: Runtime systems SHALL publish through four explicit channels
Every runtime system adapter SHALL classify its output as `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, or `AgentAction` / `EffectLedger` before that output reaches the shared runtime kernel. The kernel SHALL NOT accept source-specific blobs that require kernel-level business interpretation. When a source system needs durable attention truth while no runtime is live, it MUST publish that truth through the independent attention control plane instead of depending on a runtime-local callback.

#### Scenario: Message fact enters as a world fact
- **WHEN** a room receives a new durable message
- **THEN** the message adapter emits a `WorldFact` containing objective room-message fields
- **AND** the kernel does not infer whether the message requires a reply

#### Scenario: Room snapshot enters as a projection
- **WHEN** the model or UI requests room participants, presence, or visible-room summaries
- **THEN** the message system returns a `CapabilityProjection`
- **AND** that projection is not treated as a new task obligation by default

#### Scenario: Terminal idle enters as a scheduler signal
- **WHEN** a terminal transitions from busy to idle
- **THEN** the terminal adapter may emit a `SchedulerSignal`
- **AND** the signal may wake or rank model work without becoming task content

#### Scenario: Message send records an explicit effect
- **WHEN** the model calls `message send`
- **THEN** the runtime records an `AgentAction` and the resulting room-row mutation in the effect ledger
- **AND** the visible room mutation is attributable to that explicit action

#### Scenario: Offline source work becomes durable attention without a live runtime bridge
- **WHEN** an external system needs to create durable attention while its owner runtime is offline
- **THEN** it writes that attention through the independent attention control plane
- **AND** it does not require a live runtime-local sink to materialize the attention truth
