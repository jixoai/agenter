## ADDED Requirements

### Requirement: Shared split-detail visibility SHALL use one desktop+compact source of truth
The shared split-detail workbench layout SHALL use one `detailOpen` visibility state for both desktop persistent detail visibility and compact right-sheet visibility. Wide containers SHALL be allowed to hide the detail surface without entering compact mode, and reopening detail SHALL preserve the last persisted split ratio.

#### Scenario: Desktop detail can close without losing split intent
- **WHEN** a wide split-detail route closes its right detail surface
- **THEN** the route remains in desktop mode instead of pretending to be compact
- **THEN** reopening the detail restores the shared split at the last persisted ratio

#### Scenario: Compact detail and desktop detail reuse the same visibility state
- **WHEN** a route opens compact right detail and then grows wide enough for desktop split mode
- **THEN** the same `detailOpen` state reveals the persistent desktop detail surface
- **THEN** the route does not translate visibility through a second page-local state machine

### Requirement: Shared split-detail host SHALL own sheet and toolbar visibility orchestration
The WebUI SHALL provide one shared split-detail host for `main + right detail` page assembly. That host SHALL own compact-entry close behavior, right-sheet mounting, and shared page-toolbar close takeover instead of requiring each route to rebuild those mechanics.

#### Scenario: Entering compact mode closes detail until explicitly reopened
- **WHEN** a split-detail route first collapses from desktop into compact mode
- **THEN** the shared host closes the detail surface by default
- **THEN** the route only reopens detail through an explicit user or route action

#### Scenario: Compact detail takeover stays inside the shared host
- **WHEN** compact detail is open on a split-detail route
- **THEN** the shared host renders the sheet and the toolbar close takeover
- **THEN** the route body does not reimplement an extra close header or local sheet controller

## MODIFIED Requirements

### Requirement: Compact right detail SHALL use a shared right-sheet with toolbar close takeover
When the shared split-detail layout is in compact mode, the right detail SHALL render as a shared `rightSheet` that still belongs to the same `page-content` contract and is driven by the same `detailOpen` visibility state used on desktop. While that sheet is open, the shared page-toolbar affordance SHALL switch to `close-only` so the detail view is always dismissible from the toolbar position.

#### Scenario: Opening compact detail takes over toolbar close ownership
- **WHEN** a compact route opens the shared right detail sheet
- **THEN** the toolbar hides its normal route-local content
- **THEN** the toolbar renders a shared close affordance for the open right detail sheet

#### Scenario: Closing compact detail restores normal toolbar content
- **WHEN** the operator closes the compact right detail sheet
- **THEN** the toolbar removes the shared close-only takeover affordance
- **THEN** the route-local toolbar content becomes visible again without remounting a separate page shell
