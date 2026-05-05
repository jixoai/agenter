## ADDED Requirements

### Requirement: Runtime adapters SHALL preserve channel classification

Message, Terminal, Skill, and future adapters SHALL emit records with explicit channel classification so the kernel does not need source-specific interpretation to decide whether the record is a fact, projection invalidation, scheduler signal, or effect.

#### Scenario: Adapter output declares channel
- **WHEN** an adapter emits a record to the kernel host
- **THEN** the record declares whether it is `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, or `AgentAction` / `EffectLedger`
- **AND** the kernel host rejects or logs ambiguous source records during development/test verification

#### Scenario: New system joins without kernel branch
- **WHEN** a future runtime system is added
- **THEN** it integrates by implementing the same classification contract
- **AND** the kernel does not add a new source-specific `if system === ...` semantic branch

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

#### Scenario: Message adapter test rejects social heuristic
- **WHEN** tests ingest direct-room, group `auth:*`, and punctuation-heavy messages
- **THEN** adapter output remains raw message facts
- **AND** no reply-obligation channel is emitted

#### Scenario: Terminal adapter test separates snapshot and idle
- **WHEN** tests emit both a terminal diff and an idle transition
- **THEN** the diff is classified as world fact
- **AND** the idle transition is classified as scheduler signal
