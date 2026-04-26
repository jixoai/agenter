## MODIFIED Requirements

### Requirement: Runtime shell SHALL use shared workbench page-toolbar chrome

The runtime detail route SHALL derive its chrome from the shared `WorkbenchWindow + WorkbenchPageToolbar` contract instead of a runtime-local body header. Runtime title, runtime status, start/stop control, and runtime-tab-local chrome SHALL remain outside the scrollable page body.

#### Scenario: Runtime title and controls live in the page toolbar

- **WHEN** the operator opens a runtime route
- **THEN** the page toolbar shows the runtime title, avatar/workspace metadata, current runtime status, and the start/stop action
- **AND** the page body does not render a second stage header that repeats the same facts

#### Scenario: Stopped Heartbeat first paint can start the runtime

- **GIVEN** an existing avatar runtime route is open on `Heartbeat`
- **AND** that runtime is currently `stopped`
- **WHEN** the operator activates `Start runtime` from the shared page toolbar
- **THEN** the route eventually reflects authoritative `running` status
- **AND** the same route remains open instead of requiring the operator to return to the Avatar Catalog

#### Scenario: Runtime toggle failure is rendered in the route body

- **GIVEN** the operator activates `Start runtime` or `Stop runtime` from the shared page toolbar
- **WHEN** that action fails
- **THEN** the runtime route renders an explicit failure notice in the page body
- **AND** the failure is not left only in console noise or an ignored promise rejection
- **AND** a later successful toggle clears that route-local failure notice
