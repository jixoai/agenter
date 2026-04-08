## ADDED Requirements

### Requirement: Primary workbenches SHALL use one shared chrome-style workbench chrome

The WebUI SHALL render the top edge of `Avatars`, `Messages`, and `Terminals` through one shared workbench chrome primitive that supports browser-style tab affordances, a toolbar row beneath those tabs, and route-driven selection.

#### Scenario: Shared tabs primitive renders fixed and dynamic tabs

- **WHEN** a primary workbench contains fixed tabs, dynamic resource tabs, or both
- **THEN** the workbench renders them through the same shared tabs primitive
- **THEN** the active tab remains the one selected by the current route

#### Scenario: Active tabs and toolbar render as one continuous chrome surface

- **WHEN** a primary workbench mounts local title, metadata, or actions into the shared chrome
- **THEN** the workbench renders those controls in the toolbar row directly below the tab row
- **THEN** the active tab and toolbar present one continuous browser-style surface instead of separate page-local headers

#### Scenario: Chrome body renders as the same switched window

- **WHEN** the user switches between `Avatars`, `Messages`, or `Terminals`
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

The WebUI SHALL treat tab close as removal from the current workbench’s open-tab set. Closing a tab MUST NOT delete the underlying room or terminal, and it MUST NOT stop the underlying avatar session.

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

The shared workbench chrome SHALL include a reusable toolbar companion that keeps primary info, metadata, and local actions readable across compact and wide layouts.

#### Scenario: Toolbar content adapts without horizontal overflow

- **WHEN** a workbench renders its title, metadata, and actions inside the shared toolbar on a compact viewport or narrow container
- **THEN** the toolbar reflows those regions responsively instead of forcing horizontal clipping
- **THEN** the workbench still exposes the same local information and actions through the shared chrome contract

#### Scenario: Toolbar metadata renders as a distinct signal rail

- **WHEN** a workbench mounts status chips, counts, or passive metadata into the shared toolbar
- **THEN** the toolbar renders that metadata in a visually separated lower rail beneath the primary/action row
- **THEN** the lower chrome reads as browser toolbar structure instead of a generic badge strip
