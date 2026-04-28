## MODIFIED Requirements

### Requirement: Terminal control plane SHALL separate durable lifecycle from transient lifecycle transition truth

The terminal control plane SHALL keep durable `processPhase` and transient `lifecycleTransition` as separate facts. `lifecycleTransition` exists only to coordinate in-flight lifecycle mutations such as bootstrap and kill/stop, and MUST NOT replace the durable lifecycle contract.

#### Scenario: Create auto-bootstrap exposes a transient bootstrapping phase

- **WHEN** an authorized caller creates a terminal through the default public create flow
- **THEN** the terminal may briefly expose `lifecycleTransition = bootstrapping`
- **AND** once the start completes it exposes `processPhase = running`
- **AND** `lifecycleTransition` returns to `null`

#### Scenario: Stop exposes a transient killing phase before stopped

- **WHEN** an authorized caller stops a running terminal PTY
- **THEN** the terminal exposes `lifecycleTransition = killing` while the PTY shutdown is in flight
- **AND** once shutdown completes it exposes `processPhase = stopped`
- **AND** `lifecycleTransition` returns to `null`

#### Scenario: Conflicting lifecycle mutations are rejected during a transition

- **WHEN** one caller has already started a bootstrap or kill/stop mutation for a terminal
- **THEN** a second conflicting lifecycle mutation for that same terminal is rejected with a clear transition-in-progress style error
- **AND** the control plane does not run overlapping lifecycle mutations for the same durable terminal id

### Requirement: Terminal control plane SHALL expose durable config inspection and mutation

The terminal control plane SHALL expose canonical config read/write operations for durable terminal launch truth after creation.

#### Scenario: Get-config returns durable launch truth separately from runtime observations

- **WHEN** a caller requests terminal config for an existing terminal
- **THEN** the result includes durable launch truth such as `command`, `launchCwd`, `processKind`, profile fields, and metadata
- **AND** it may include `processPhase` and `lifecycleTransition` as lifecycle summary fields
- **AND** it does not replace durable config fields with runtime-observed `currentPath` or `currentTitle`

#### Scenario: Set-config updates next-bootstrap launch truth

- **WHEN** a caller updates terminal config such as default launch cwd, command, title, or metadata
- **THEN** the durable terminal record is updated without changing the terminal id
- **AND** later bootstrap uses the updated durable launch truth

#### Scenario: Geometry config may apply live and durably

- **WHEN** a caller updates `cols` or `rows` for a running terminal
- **THEN** the durable terminal config is updated
- **AND** the running PTY geometry is resized to match

#### Scenario: Non-geometry launch changes do not rewrite the running process in place

- **WHEN** a caller updates launch fields such as `command`, `launchCwd`, or environment for a running terminal
- **THEN** the durable config is updated immediately
- **AND** the already-running PTY keeps its current process
- **AND** the updated launch fields take effect on the next bootstrap
