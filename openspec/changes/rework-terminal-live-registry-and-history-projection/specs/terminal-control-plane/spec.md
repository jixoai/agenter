## ADDED Requirements

### Requirement: Terminal instance history projection SHALL separate live terminals from dead evidence
The terminal control plane SHALL treat terminal instances as one durable record family with explicit projection boundaries. Default live listing and live lookup SHALL return only actionable live instances, while dead instances SHALL remain available only through explicit history or archive queries.

#### Scenario: Live list excludes killed terminal instances
- **WHEN** a terminal instance has completed the killed flow
- **THEN** the default terminal list does not return that terminal instance
- **AND** callers must use an explicit history-oriented query to inspect it

#### Scenario: History query returns killed instance evidence
- **WHEN** a caller queries terminal history for an instance that was previously killed
- **THEN** the control plane returns that terminal instance's durable lifecycle and transcript evidence
- **AND** the instance does not re-enter the live registry merely because it was inspected

#### Scenario: Archived instance requires explicit archive projection
- **WHEN** a terminal instance has been archived
- **THEN** default live and default history listings do not return it
- **AND** an explicit archive-aware query can still inspect it until final delete

### Requirement: Terminal death SHALL converge on one killed flow
The terminal control plane SHALL route explicit stop/kill, natural PTY exit, and daemon cold-start compensation through one authoritative killed flow. That flow SHALL own durable lifecycle mutation, live-registry removal, transient cleanup, and downstream invalidation.

#### Scenario: Explicit stop uses the killed flow
- **WHEN** an authorized caller stops a running terminal PTY
- **THEN** the control plane routes that terminal through the shared killed flow
- **AND** the terminal leaves the live registry when the flow completes

#### Scenario: Natural PTY exit uses the same killed flow
- **WHEN** a terminal PTY exits without an explicit operator stop
- **THEN** the control plane routes that terminal through the same shared killed flow
- **AND** downstream consumers observe the same lifecycle consequences as an explicit kill, with the exit reason preserved as evidence

#### Scenario: Daemon cold-start compensation replays the killed flow
- **WHEN** daemon startup detects a terminal row that was previously marked running but no longer has a live PTY
- **THEN** the control plane replays the shared killed flow for that terminal instance
- **AND** the system does not stop at a storage-only state rewrite

## MODIFIED Requirements

### Requirement: Terminal control plane SHALL own terminal lifecycle operations
The terminal control plane SHALL expose lifecycle operations for listing, creating, bootstrapping, stopping, archiving, and deleting globally durable terminal instances through one canonical API family independent of session startup order. Terminal death and terminal deletion are distinct operations with distinct durable outcomes, and default listing SHALL expose only live actionable instances.

#### Scenario: Create a global shell terminal without first booting a session
- **WHEN** an authorized caller invokes terminal create without an explicit process descriptor
- **THEN** the control plane creates a terminal using the default shell profile in the global terminal catalog
- **THEN** the response returns the terminal id and applied process profile metadata

#### Scenario: Stop removes the instance from the live projection
- **WHEN** a caller with sufficient rights invokes terminal stop for an existing running terminal id
- **THEN** the PTY is stopped through the shared killed flow without deleting the durable terminal-instance evidence
- **THEN** later default live reads no longer resolve that terminal id as a live terminal
- **AND** later history reads can still resolve that terminal id until archive or delete occurs

#### Scenario: Delete removes the terminal catalog entry
- **WHEN** an authorized caller deletes a terminal
- **THEN** the terminal is removed from the durable terminal-instance catalog and remaining retained evidence according to terminal-system delete policy
- **AND** later live, history, and archive reads for that terminal id fail with a terminal-not-found style error

#### Scenario: Bootstrap is explicit
- **WHEN** a terminal is `not_started`
- **THEN** the PTY only starts after an explicit bootstrap lifecycle operation
- **AND** listing or opening the route does not implicitly start it

#### Scenario: Archive hides history without deleting evidence
- **WHEN** an authorized caller archives a killed terminal instance
- **THEN** the instance leaves the default history projection
- **AND** its durable evidence remains queryable through explicit archive-aware inspection until delete occurs
