## MODIFIED Requirements

### Requirement: Runtime publications SHALL expose terminal launch truth, observed identity, and process lifecycle separately

Runtime snapshots and terminal realtime publications SHALL expose terminal launch/config truth, runtime observed identity truth, and durable process lifecycle truth as separate fields instead of compressing them into a single `cwd/title/running/status` blob.

#### Scenario: Launch cwd stays separate from observed current path

- **WHEN** a terminal was created with launch cwd `/repo/app` but the running shell later `cd`s to `/repo/app/packages/webui`
- **THEN** the runtime projection preserves `/repo/app` as launch truth
- **AND** it publishes `/repo/app/packages/webui` as observed current path

#### Scenario: Configured title stays separate from observed current title

- **WHEN** a terminal has configured title `Ops shell` but the runtime later emits a different OSC/xterm title
- **THEN** the runtime projection preserves `Ops shell` as configured title
- **AND** it publishes the latest observed title separately for UI resolution

#### Scenario: Process lifecycle stays separate from activity truth

- **WHEN** a terminal PTY exits
- **THEN** the runtime projection preserves whether the terminal is `not_started`, `running`, or `stopped`
- **AND** it records stop reason, exit code/signal, and stopped timestamp separately from `IDLE/BUSY`

### Requirement: Runtime terminal surface invalidation SHALL refresh one resource family at a time

Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, grants, approvals, activity, lifecycle, and observed identity without rebuilding terminal truth in route-local code.

#### Scenario: Lifecycle change invalidates catalog-facing terminal truth without using snapshot ticks

- **WHEN** a terminal is explicitly bootstrapped, stopped, or deleted
- **THEN** runtime publications identify the catalog-facing lifecycle mutation explicitly
- **AND** clients do not need to infer lifecycle from `snapshot/status` render ticks

#### Scenario: Observed identity updates stay distinct from launch truth

- **WHEN** the running terminal emits a new title or current path observation
- **THEN** runtime publications can refresh observed identity without mutating launch config fields
- **AND** clients preserve both truths simultaneously
