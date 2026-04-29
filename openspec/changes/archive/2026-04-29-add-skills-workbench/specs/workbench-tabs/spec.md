## MODIFIED Requirements

### Requirement: Primary workbenches SHALL use one shared chrome-style workbench chrome

The WebUI SHALL render the top edge of `Avatars`, `Skills`, `Messages`, `Workspaces`, and `Terminals` through one shared workbench chrome primitive that supports browser-style tab affordances, a toolbar row beneath those tabs, and route-driven selection.

#### Scenario: Shared tabs primitive renders fixed and dynamic tabs
- **WHEN** a primary workbench contains fixed tabs, dynamic resource tabs, or both
- **THEN** the workbench renders them through the same shared tabs primitive
- **THEN** the active tab remains the one selected by the current route

#### Scenario: Fixed management tabs remain while addable tabs open
- **WHEN** a primary workbench keeps a fixed start, catalog, or directory tab and the user opens runtime, creation, or dedicated avatar skill flows from that workbench
- **THEN** the fixed tab remains visible as part of the same chrome window
- **THEN** each runtime, creation, or avatar skill flow opens as its own addable tab instead of replacing the fixed management tab

#### Scenario: Skills catalog page-tabs mirror the runtime inheritance law
- **WHEN** the Skills workbench renders its fixed catalog tab
- **THEN** the page-tabs appear in `shared / built-in / global / avatars` order
- **THEN** the first visible tab is also the default route selection
- **THEN** the tab order is treated as a durable override contract rather than a cosmetic sort

#### Scenario: Active tabs and toolbar render as one continuous chrome surface
- **WHEN** a primary workbench mounts local title, metadata, or actions into the shared chrome
- **THEN** the workbench renders those controls in the toolbar row directly below the tab row
- **THEN** the active tab and toolbar present one continuous browser-style surface instead of separate page-local headers
- **THEN** the active tab does not keep a visible bottom dividing border against the toolbar surface

#### Scenario: Chrome body renders as the same switched window
- **WHEN** the user switches between `Avatars`, `Skills`, `Messages`, `Workspaces`, or `Terminals`
- **THEN** the selected workbench renders its tab body as part of the same shared chrome window
- **THEN** the result reads as one switched window surface rather than detached tab chrome above a separate page card

#### Scenario: Route roots inside the window do not recreate detached outer cards
- **WHEN** a primary workbench route renders a transcript, creation flow, catalog browser, history index, or secondary-pane interior inside the shared workbench window
- **THEN** the route mounts its root surface through the shared integrated page/pane scaffold
- **THEN** the route does not add a second detached outer card around the entire page body

#### Scenario: Tabs carry rich tab affordances
- **WHEN** a workbench tab needs iconography, avatar identity, badge state, loading state, tooltip help, or an overflow menu
- **THEN** the shared primitive exposes those affordances without requiring route-local hand-built tab chrome
- **THEN** the workbench preserves one consistent tab interaction model across systems
