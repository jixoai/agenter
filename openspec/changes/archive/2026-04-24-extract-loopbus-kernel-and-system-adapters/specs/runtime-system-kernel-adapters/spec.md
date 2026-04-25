## ADDED Requirements

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
