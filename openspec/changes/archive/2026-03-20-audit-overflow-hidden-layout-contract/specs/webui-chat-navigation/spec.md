## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. On compact viewports, the route header MUST stay compact by keeping only navigation/context affordances visible and moving route actions into overflow surfaces. The shell MUST preserve explicit overflow ownership so layout wrappers do not clip route content by default.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell

#### Scenario: Compact header collapses secondary actions
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the route header keeps navigation and context visible while session and route actions are exposed through overflow surfaces instead of always-on header buttons

#### Scenario: Shell layout does not clip the route viewport
- **WHEN** a workspace route renders long panel content inside the application shell
- **THEN** shell wrappers preserve sizing without becoming implicit clipping layers
- **THEN** the route content relies on its own primary scroll viewport

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL keep one shared master-detail model for the `Workspaces ↔ Sessions` flow, while workspace `Chat`, `Devtools`, and `Settings` are rendered inside the workspace shell without duplicating outer page chrome or padding. The master-detail shell MUST preserve one explicit detail viewport instead of stacking hidden wrappers across desktop and compact layouts.

#### Scenario: Desktop keeps workspace-session split behavior
- **WHEN** the application is rendered on a desktop-sized viewport
- **THEN** the Workspaces view uses the shared resizable master-detail layout for workspace and session inspection

#### Scenario: Mobile keeps workspace-session detail flow
- **WHEN** the application is rendered on a compact viewport and the user opens an auxiliary panel
- **THEN** the Sessions detail content is presented through the shared mobile detail flow
- **THEN** workspace shell routes still keep their own compact route chrome instead of reusing the Workspaces detail layout

#### Scenario: Master-detail detail pane keeps one scroll owner
- **WHEN** the desktop detail pane or compact sheet contains long content
- **THEN** the detail surface exposes one deliberate primary scroll viewport
- **THEN** outer master-detail wrappers do not clip or suppress that scrolling behavior
