## MODIFIED Requirements

### Requirement: LoopBus SHALL provide an attention-first plugin pipeline
The runtime SHALL expose an attention-first plugin pipeline where external systems integrate by registering plugins, source adapters, egress adapters, and stable lifecycle hooks around attention loading, transformation, scheduling, model calls, and effect dispatch.

#### Scenario: Built-in plugins register deterministic hooks
- **WHEN** the runtime starts a session
- **THEN** built-in plugins can register sources, egress adapters, hooks, and exposed services through one plugin runtime
- **THEN** those hooks execute with deterministic ordering semantics instead of ad-hoc callback arrays

#### Scenario: Plugins extend both ingress and egress
- **WHEN** a system plugin participates in runtime orchestration
- **THEN** it can contribute source invalidation behavior, attention transforms, cycle policies, or egress dispatch behavior through the same pipeline
- **THEN** the session runtime does not need private hand-written integration code for that system

### Requirement: LoopBus hooks SHALL use explicit execution kinds
Each LoopBus hook type SHALL define a stable execution kind such as `first`, `sequential`, `parallel`, or `sequential-waterfall`, and plugin registration SHALL preserve those semantics consistently across ingress and egress phases.

#### Scenario: Waterfall hooks receive the previous result
- **WHEN** multiple plugins participate in a `sequential-waterfall` hook
- **THEN** each handler receives the value produced by the previous handler
- **THEN** the final result is deterministic for the same plugin order and inputs

#### Scenario: First hooks stop at the first authoritative result
- **WHEN** multiple plugins participate in a `first` hook such as cycle-start arbitration or egress ownership selection
- **THEN** the runtime accepts the first non-null authoritative result
- **THEN** later handlers are not invoked for that hook execution

### Requirement: LoopBus plugins SHALL expose shared services safely
The plugin runtime SHALL allow plugins to expose and consume named services through a typed service registry so future system integrations can cooperate without reaching into session internals.

#### Scenario: One plugin consumes another plugin's service
- **WHEN** a plugin exposes a named service during setup
- **THEN** another plugin can resolve that service through the plugin API
- **THEN** the interaction does not require direct access to `SessionRuntime` private state
