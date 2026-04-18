# workbench-tabs Specification

## Purpose
Define the shared browser-style workbench chrome for primary operator systems, including tab lifecycle, context actions, the fixed-height toolbar companion contract, and the adaptive page-content window law.

## Requirements
### Requirement: Primary workbenches SHALL use one shared chrome-style workbench chrome
The WebUI SHALL render the top edge of `Avatars`, `Messages`, `Workspaces`, and `Terminals` through one shared workbench chrome primitive that supports browser-style tab affordances, a toolbar row beneath those tabs, and route-driven selection.

#### Scenario: Shared tabs primitive renders fixed and dynamic tabs
- **WHEN** a primary workbench contains fixed tabs, dynamic resource tabs, or both
- **THEN** the workbench renders them through the same shared tabs primitive
- **THEN** the active tab remains the one selected by the current route

#### Scenario: Fixed management tabs remain while addable tabs open
- **WHEN** a primary workbench keeps a fixed start or catalog tab and the user opens runtime or creation flows from that workbench
- **THEN** the fixed tab remains visible as part of the same chrome window
- **THEN** each runtime or creation flow opens as its own addable tab instead of replacing the fixed management tab

#### Scenario: Active tabs and toolbar render as one continuous chrome surface
- **WHEN** a primary workbench mounts local title, metadata, or actions into the shared chrome
- **THEN** the workbench renders those controls in the toolbar row directly below the tab row
- **THEN** the active tab and toolbar present one continuous browser-style surface instead of separate page-local headers
- **THEN** the active tab does not keep a visible bottom dividing border against the toolbar surface

#### Scenario: Chrome body renders as the same switched window
- **WHEN** the user switches between `Avatars`, `Messages`, `Workspaces`, or `Terminals`
- **THEN** the selected workbench renders its tab body as part of the same shared chrome window
- **THEN** the result reads as one switched window surface rather than detached tab chrome above a separate page card

#### Scenario: Route roots inside the window do not recreate detached outer cards
- **WHEN** a primary workbench route renders a transcript, creation flow, history index, or split-view interior inside the shared workbench window
- **THEN** the route mounts its root surface through the shared integrated page/pane scaffold
- **THEN** the route does not add a second detached outer card around the entire page body

#### Scenario: Tabs carry rich tab affordances
- **WHEN** a workbench tab needs iconography, avatar identity, badge state, loading state, tooltip help, or an overflow menu
- **THEN** the shared primitive exposes those affordances without requiring route-local hand-built tab chrome
- **THEN** the workbench preserves one consistent tab interaction model across systems

### Requirement: Closing a workbench tab SHALL close workbench presence instead of deleting durable truth
The WebUI SHALL treat tab close as removal from the current workbench's open-tab set. Closing a tab MUST NOT delete the underlying room or terminal, and it MUST NOT stop the underlying avatar session.

#### Scenario: Closing a room or terminal tab keeps the resource durable
- **WHEN** the user closes a `Messages` room tab or a `Terminals` tab
- **THEN** that tab disappears from the current workbench open set
- **THEN** the underlying room or terminal still exists and can be reopened later

#### Scenario: Closing a running-avatar tab keeps the session running
- **WHEN** the user closes a running-avatar tab inside `Avatars`
- **THEN** that session tab disappears from the current workbench open set
- **THEN** the session remains alive until an explicit runtime stop action occurs

### Requirement: Workbench tabs SHALL expose a context-menu extension point
The shared workbench tabs primitive SHALL support context-menu actions so each workbench can attach secondary actions without reimplementing tab interaction plumbing.

#### Scenario: Workbench-specific context actions are attached to the shared primitive
- **WHEN** a room, terminal, or running-avatar tab needs contextual actions
- **THEN** the workbench attaches those actions through the shared context-menu extension point
- **THEN** the tab primitive remains reusable while still allowing workbench-specific commands

### Requirement: Workbench chrome SHALL provide a responsive toolbar companion
The shared workbench chrome SHALL include a reusable toolbar companion that keeps local information and actions readable across compact and wide layouts while remaining a fixed-height chrome region. The shared toolbar primitive SHALL provide viewport state and container-query hooks, but page-specific content layout remains the responsibility of the consuming workbench surface.

#### Scenario: Toolbar slot stays fixed while content adapts
- **WHEN** a workbench renders its local title, actions, dense metadata, or local navigation inside the shared toolbar on a compact viewport or narrow container
- **THEN** the toolbar remains fixed-height inside chrome and does not scroll with `page_content`
- **THEN** the workbench adapts its own content inside that region instead of leaking local chrome into `page_content`

#### Scenario: Pages may use one-row or two-row toolbar content
- **WHEN** a workbench only needs one line of local chrome
- **THEN** it may render a single-row toolbar band
- **WHEN** a workbench needs both identity/actions and local navigation or perspective switching
- **THEN** it may render a two-row toolbar band while keeping both rows compact enough to stay inside the same fixed-height chrome region

#### Scenario: Shared toolbar primitive does not encode page-owned row semantics
- **WHEN** a page needs a dense or specialized toolbar layout
- **THEN** the shared toolbar primitive exposes only responsive state and slot/container hooks
- **THEN** the page itself decides how to arrange its local toolbar content inside the fixed chrome slot

### Requirement: Workbench window SHALL expose explicit `tabs`, `page_toolbar`, and `page_content` bands
The shared chrome window SHALL read as one application window with three explicit vertical bands: `tabs`, `page_toolbar`, and `page_content`. `page_toolbar` SHALL remain fixed-height chrome, while `page_content` SHALL be the adaptive content viewport that receives the page-owned layout.

#### Scenario: Fixed chrome stays outside the adaptive content viewport
- **WHEN** a workbench route renders scrollable or multi-pane content
- **THEN** the `tabs` strip and `page_toolbar` remain outside the scrolling content viewport
- **THEN** the route places scrolling responsibility inside `page_content` instead of stretching the toolbar or tab bands

#### Scenario: Page content hosts the page-owned tri-region layout
- **WHEN** a workbench route needs a primary stage, a supporting bottom surface, and an advanced detail drawer
- **THEN** that route composes those regions inside `page_content`
- **THEN** the shared chrome does not insert a second detached outer card or page-local pseudo-header above them

#### Scenario: Page content reads as the route's own window body
- **WHEN** a route renders inside the shared chrome window
- **THEN** `page_content` behaves like one independent embedded window body for that route
- **THEN** the route avoids wrapping its entire body in another large rounded or bordered page card
- **THEN** borders, padding, and separators are used only for route-local subregions that genuinely need them

### Requirement: Workbench open-tab projections SHALL remain device-local even when resources are durable
Workbench open-tab sets SHALL represent the current device's projection of what is open, not a globally unified tab strip. Durable resources such as chats, terminals, runtime sessions, or draft resources MAY sync independently, but each device SHALL choose its own open-tab projection.

#### Scenario: Desktop and mobile keep different tab strips for the same actor
- **WHEN** the same authenticated actor opens the application on desktop and mobile
- **THEN** each device may keep a different set and ordering of open workbench tabs
- **AND** syncing a durable resource on one device does not force the other device to mirror the same open-tab strip

#### Scenario: Closing a local draft tab does not delete the durable draft
- **WHEN** a workbench tab points at a durable draft resource and the operator closes that tab
- **THEN** the current device removes only the local tab projection
- **AND** the underlying draft resource remains durable until explicit discard or successful completion
