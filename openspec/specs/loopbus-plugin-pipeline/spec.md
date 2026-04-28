## Purpose

Define the attention-first LoopBus plugin pipeline and hook semantics.
## Requirements

### Requirement: LoopBus SHALL provide an attention-first plugin pipeline

The runtime SHALL expose an attention-first plugin pipeline where external systems integrate by registering plugins, source adapters, delivery observers, explicit mutation providers, and stable lifecycle hooks around attention loading, transformation, scheduling, model calls, and effect inspection.

#### Scenario: Built-in plugins register deterministic hooks
- **WHEN** the runtime starts a session
- **THEN** built-in plugins can register sources, delivery observers, hooks, and exposed services through one plugin runtime
- **THEN** those hooks execute with deterministic ordering semantics instead of ad-hoc callback arrays

#### Scenario: Plugins extend ingress and explicit effects
- **WHEN** a system plugin participates in runtime orchestration
- **THEN** it can contribute source invalidation behavior, attention transforms, cycle policies, delivery observation, or explicit mutation providers through the same pipeline
- **THEN** the session runtime does not need private hand-written integration code for that system

#### Scenario: Deferred attention refs stay invalidated until the load gate opens
- **WHEN** a plugin denies `attentionShouldLoad` for an invalidated source ref
- **THEN** that ref is not converted into attention drafts in the current round
- **AND** the runtime keeps the ref invalidated for the next eligible round instead of dropping it

### Requirement: LoopBus hooks SHALL use explicit execution kinds

Each LoopBus hook type SHALL define a stable execution kind such as `first`, `sequential`, `parallel`, or `sequential-waterfall`, and plugin registration SHALL preserve those semantics consistently across ingress, delivery, and lifecycle phases.

#### Scenario: Waterfall hooks receive the previous result
- **WHEN** multiple plugins participate in a `sequential-waterfall` hook
- **THEN** each handler receives the value produced by the previous handler
- **THEN** the final result is deterministic for the same plugin order and inputs

#### Scenario: First hooks stop at the first authoritative result
- **WHEN** multiple plugins participate in a `first` hook such as cycle-start arbitration or delivery ownership selection
- **THEN** the runtime accepts the first non-null authoritative result
- **THEN** later handlers are not invoked for that hook execution

#### Scenario: The attention load gate stops at the first authoritative decision
- **WHEN** multiple plugins participate in `attentionShouldLoad`
- **THEN** the runtime accepts the first non-null authoritative decision
- **AND** later handlers are not invoked for that source ref

### Requirement: LoopBus plugins SHALL expose shared services safely

The plugin runtime SHALL allow plugins to expose and consume named services through a typed service registry so future system integrations can cooperate without reaching into session internals.

#### Scenario: One plugin consumes another plugin's service
- **WHEN** a plugin exposes a named service during setup
- **THEN** another plugin can resolve that service through the plugin API
- **THEN** the interaction does not require direct access to `SessionRuntime` private state

### Requirement: Plugin/runtime source contracts SHALL distinguish lookup hints from attention payload facts

LoopBus plugin contracts SHALL use typed source coordinates and first-class read-result fields for adapter lookup. They SHALL treat source lookup hints as adapter-internal addressing only, and they SHALL NOT expose a generic source-ref or read-result metadata bag. Any fact that must survive into durable attention or model payloads SHALL be promoted into typed draft fields before commit serialization.

#### Scenario: Built-in source refs stay typed
- **WHEN** a built-in system invalidates a message, terminal, or task source
- **THEN** the invalidated ref carries only typed coordinates required to re-read truth
- **AND** it does not carry a generic `meta` object

#### Scenario: Source reads expose only first-class scheduler fields
- **WHEN** a source adapter reads a deferred source ref
- **THEN** the read result exposes only explicit fields such as `kind`, `fromHash`, `toHash`, `semanticHash`, or `viewHash`
- **AND** AI-visible detail must still be promoted into attention drafts instead of a read-result metadata bag

#### Scenario: Deferred source refs do not become hidden model state
- **WHEN** a plugin invalidates a source ref and the runtime reads it in a later eligible round
- **THEN** any AI-relevant detail required by that source is emitted through typed draft fields or commit body content
- **AND** the runtime does not rely on a generic source-ref metadata bag as hidden model state
