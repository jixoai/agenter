## MODIFIED Requirements

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
