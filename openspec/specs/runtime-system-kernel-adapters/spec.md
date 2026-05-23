# runtime-system-kernel-adapters Specification

## Purpose

Define the neutral adapter contract that Message, Terminal, Skill, and future runtime systems must use when integrating with the LoopBus kernel.

## Requirements

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

### Requirement: Runtime host SHALL mount adapters as the only system ingress bridge
The runtime host SHALL own adapter lifecycle and SHALL treat mounted adapters as the only supported ingress bridge into the kernel.

#### Scenario: Session boot mounts kernel and adapters without source-specific kernel imports
- **WHEN** a session runtime starts
- **THEN** it creates the standalone kernel and mounts the configured system adapters
- **AND** source-specific ingress reaches the kernel only through those mounted adapters

#### Scenario: A future system can join without changing kernel imports
- **WHEN** a new runtime system is added later
- **THEN** it can integrate by adding one new adapter implementation
- **AND** the kernel package does not need new source-specific imports or source-name switch branches

### Requirement: Adapters SHALL observe kernel lifecycle through a stable host interface
Adapters SHALL receive kernel lifecycle events through a host-facing interface instead of reading kernel storage directly.

#### Scenario: Message adapter observes delivery receipts through the host interface
- **WHEN** the kernel records dispatch or receipt facts for message-originated work
- **THEN** the message adapter can observe those lifecycle events through the host interface
- **AND** it does not query kernel-private storage tables to infer them

#### Scenario: Irrelevant kernel events can be ignored without affecting kernel law
- **WHEN** an adapter receives a kernel event that does not apply to that system
- **THEN** the adapter may ignore the event
- **AND** the kernel still keeps one consistent lifecycle law for all systems

### Requirement: Runtime adapters SHALL preserve channel classification

Message, Terminal, Skill, and future adapters SHALL emit records with explicit channel classification so the kernel does not need source-specific interpretation to decide whether the record is a fact, projection invalidation, scheduler signal, or effect.

#### Scenario: Adapter output declares its channel

- **WHEN** an adapter emits a record to the kernel host
- **THEN** the record declares whether it is `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, or `AgentAction` / `EffectLedger`
- **AND** development or test verification rejects or logs ambiguous source records

#### Scenario: New system joins without a kernel semantic branch

- **WHEN** a future runtime system is added
- **THEN** it integrates by implementing the same classification contract
- **AND** the kernel does not add a new source-specific semantic branch

### Requirement: Runtime adapter ingress SHALL require explicit context mutation intent for apply

Runtime adapters SHALL default missing `contextMutation` to `preserve` when converting system ingress envelopes into attention commits. An adapter MAY request `apply` only when the target context is explicitly owned by that system projection rather than by Avatar-authored summarization.

#### Scenario: Missing context mutation is context-preserving

- **WHEN** an adapter emits a valid ingress envelope without `contextMutation`
- **THEN** the committed attention item preserves the target `attentionContext`
- **AND** the commit still advances history, head commit, and score state

#### Scenario: Source-owned projection opts into apply

- **WHEN** an adapter emits a valid ingress envelope with `contextMutation` set to `apply`
- **THEN** the attention commit may update the target context according to the commit change

### Requirement: Adapters SHALL NOT convert scheduler lifecycle into task obligations

Adapters MUST NOT turn focus, idle, watcher dirtiness, timer, or lifecycle coordination into source-specific model obligations unless an objective world fact or explicit action predicate requires model re-decision.

#### Scenario: Terminal focus stays scheduler-only

- **WHEN** terminal focus changes
- **THEN** the terminal adapter emits scheduler state or UI invalidation only
- **AND** it does not commit a task attention item that says the model must act

#### Scenario: Skill watcher dirtiness stays index-level by default

- **WHEN** a skill file watcher observes dirtiness
- **THEN** the skill adapter refreshes or invalidates the skill capability index
- **AND** it does not create a default user-task attention context solely because the index changed

### Requirement: Adapter tests SHALL prove source orthogonality

Each migrated adapter SHALL have focused tests proving that source-specific behavior is expressed through the shared channel contract rather than direct runtime branches.

#### Scenario: Message adapter test rejects social heuristics

- **WHEN** tests ingest direct-room, group `auth:*`, and punctuation-heavy messages
- **THEN** adapter output remains raw message facts
- **AND** no reply-obligation channel is emitted

#### Scenario: Terminal adapter test separates snapshot and idle

- **WHEN** tests emit both a terminal diff and an idle transition
- **THEN** the diff is classified as a world fact
- **AND** the idle transition is classified as a scheduler signal

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
