## MODIFIED Requirements

### Requirement: Terminal control plane SHALL own terminal lifecycle operations

The terminal control plane SHALL expose lifecycle operations for listing, creating, bootstrapping, stopping, and deleting globally durable terminal instances through one canonical API family independent of session startup order. `stop PTY` and `delete terminal` are distinct operations with distinct durable outcomes.

#### Scenario: Stop preserves the terminal catalog entry

- **WHEN** an authorized caller stops a running terminal PTY
- **THEN** the PTY stops without removing the terminal catalog entry
- **AND** later listing still returns that terminal with lifecycle truth indicating it is stopped

#### Scenario: Delete removes the terminal catalog entry

- **WHEN** an authorized caller deletes a terminal
- **THEN** the terminal is removed from the global terminal catalog
- **AND** later reads for that terminal id fail with a terminal-not-found style error

#### Scenario: Bootstrap is explicit

- **WHEN** a terminal is `not_started` or `stopped`
- **THEN** the PTY only starts after an explicit bootstrap lifecycle operation
- **AND** listing or opening the route does not implicitly start it

### Requirement: Terminal inspection SHALL prefer read and snapshot primitives

The terminal control plane SHALL expose `terminal_read` and `terminal_snapshot` as the primary inspection primitives, and those primitives SHALL inspect existing runtime truth without mutating lifecycle.

#### Scenario: Inspection does not auto-start a stopped terminal

- **WHEN** a caller invokes `terminal_read` or `terminal_snapshot` for a `not_started` or `stopped` terminal
- **THEN** the control plane returns a terminal-not-running style failure
- **AND** the inspection path does not implicitly bootstrap the terminal process

### Requirement: Terminal observation activity SHALL be explicit

Terminal inspection MUST NOT append activity history by default. Activity records for reads SHALL only be written when the caller explicitly opts into observation recording.

#### Scenario: Pure inspection preserves lifecycle neutrality

- **WHEN** a caller reads a stopped terminal without observation recording
- **THEN** no activity event is appended
- **AND** the terminal lifecycle remains unchanged

### Requirement: Terminal automation input SHALL respect explicit lifecycle boundaries

Automation-facing terminal input SHALL target already-running PTYs only. The write/input path MUST NOT bootstrap a stopped terminal as a side effect.

#### Scenario: Write does not auto-start a stopped terminal

- **WHEN** a caller invokes terminal write or terminal input for a `not_started` or `stopped` terminal
- **THEN** the call fails with a lifecycle-not-running style error
- **AND** the PTY remains stopped until an explicit bootstrap occurs
