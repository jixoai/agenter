## MODIFIED Requirements

### Requirement: Runtime systems SHALL integrate with the kernel through a neutral adapter contract
Message, Terminal, Skill, and future runtime systems SHALL publish work into the LoopBus kernel through a shared adapter contract instead of mutating attention or kernel state directly from `SessionRuntime`.

#### Scenario: Message ingress uses the same adapter contract as other systems
- **WHEN** room ingress creates new runtime work for a focused or background message context
- **THEN** the message adapter emits neutral ingress envelopes through the shared adapter contract
- **AND** the kernel does not import or call MessageSystem-specific APIs to interpret that ingress

#### Scenario: Terminal observations use the same adapter contract
- **WHEN** a terminal adapter observes focused dirty state, lifecycle change, or actionable snapshot work
- **THEN** it emits neutral ingress envelopes through the same shared adapter contract
- **AND** the kernel does not need terminal-specific branch logic to schedule that work

#### Scenario: Terminal passive observations stay outside direct ingress commit
- **WHEN** a terminal adapter observes a terminal change that the terminal activity bridge classifies as passive observation
- **THEN** the adapter preserves that observation in terminal-owned truth without emitting kernel ingress for it
- **AND** passive observation does not become adapter-committed runtime work merely because the terminal changed

#### Scenario: Skill refresh uses the same adapter contract
- **WHEN** the runtime skill system refreshes its durable snapshot or reminder facts
- **THEN** the skill adapter forwards those facts through the shared adapter contract
- **AND** the kernel does not need to know how watcher or skill refresh internals work

## ADDED Requirements

### Requirement: Terminal adapter SHALL separate observation from ingress promotion

The terminal adapter SHALL treat terminal observation and runtime ingress promotion as distinct phases. Dirty markers, wait handles, and status changes MAY feed the bridge's observation phase, but only bridge-approved actionable changes SHALL be promoted into runtime ingress.

#### Scenario: Dirty terminal queues observation instead of direct ingress
- **WHEN** a terminal semantic change marks a focused terminal dirty
- **THEN** the adapter queues that terminal for bridge observation
- **AND** it does not directly equate dirty state with committed kernel ingress

#### Scenario: Lifecycle ingress bypasses passive observation rules only when explicitly lifecycle-scoped
- **WHEN** the terminal adapter receives a lifecycle ingress such as bootstrap, stop, delete, or approval mutation
- **THEN** it may commit that lifecycle ingress directly through the host interface
- **AND** ordinary snapshot or diff observations still remain subject to bridge classification

### Requirement: Adapter wake signals SHALL be bridge-owned for terminal activity

The terminal adapter SHALL NOT expose two independent runtime wake semantics for the same terminal change. Any low-level wait handle or dirty signal used for terminal observation SHALL funnel through one bridge-owned wake decision.

#### Scenario: Wait-handle observation does not create parallel scheduler truth
- **WHEN** a scheduler-facing wait primitive observes a terminal commit cursor advance
- **THEN** that observation is treated as bridge input
- **AND** the scheduler does not independently conclude that terminal ingress must be collected before the bridge decides actionability

#### Scenario: Dirty-signal observation does not double-notify runtime
- **WHEN** a dirty terminal change has already been converted into one bridge wake decision
- **THEN** later duplicate observation of the same terminal change does not emit a second runtime signal
- **AND** adapter tests can prove that one physical change maps to one runtime wake decision
