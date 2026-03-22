## Purpose

Define the attention-first LoopBus plugin pipeline and hook semantics.

## Requirements

### Requirement: LoopBus SHALL provide an attention-first plugin pipeline
The runtime SHALL expose a LoopBus plugin pipeline where external systems integrate by registering plugins, source adapters, and stable lifecycle hooks around attention loading, transformation, and cycle scheduling.

#### Scenario: Built-in plugins register deterministic hooks
- **WHEN** the runtime starts a session
- **THEN** built-in plugins can register sources, hooks, and exposed services through one LoopBus plugin runtime
- **THEN** those hooks execute with deterministic ordering semantics instead of ad-hoc callback arrays

### Requirement: LoopBus hooks SHALL use explicit execution kinds
Each LoopBus hook type SHALL define a stable execution kind such as `first`, `sequential`, `parallel`, or `sequential-waterfall`, and plugin registration SHALL preserve those semantics consistently.

#### Scenario: Waterfall hooks receive the previous result
- **WHEN** multiple plugins participate in a `sequential-waterfall` hook
- **THEN** each handler receives the value produced by the previous handler
- **THEN** the final result is deterministic for the same plugin order and inputs

#### Scenario: First hooks stop at the first authoritative result
- **WHEN** multiple plugins participate in a `first` hook such as cycle-start arbitration
- **THEN** the runtime accepts the first non-null authoritative result
- **THEN** later handlers are not invoked for that hook execution

### Requirement: LoopBus plugins SHALL expose shared services safely
The plugin runtime SHALL allow plugins to expose and consume named services through a typed service registry so that future system integrations can cooperate without reaching into session internals.

#### Scenario: One plugin consumes another plugin's service
- **WHEN** a plugin exposes a named service during setup
- **THEN** another plugin can resolve that service through the plugin API
- **THEN** the interaction does not require direct access to `SessionRuntime` private state
