## Purpose

Define the WebUI navigation shell, workspace-scoped routes, and shared master-detail interaction model around Quick Start and Workspaces.
## Requirements
### Requirement: Quick Start is a primary application view
The WebUI SHALL expose Quick Start as a dedicated primary view that is separate from Workspaces and the workspace shell, and it SHALL provide the current workspace controls and recent session entry points needed to start work immediately.

#### Scenario: No active session opens on Quick Start
- **WHEN** the application opens without an active session selected
- **THEN** the main content shows the Quick Start view instead of a workspace shell or empty Chat view

#### Scenario: Quick Start shows recent sessions
- **WHEN** recent sessions are available for the selected workspace context
- **THEN** Quick Start shows up to three recent session entries that can be used to resume work

#### Scenario: Compact Quick Start keeps the primary composer and start action in the first viewport
- **WHEN** the application is rendered on a compact viewport
- **THEN** the selected workspace control, shared AI input composer, and primary `Start` action remain visible without scrolling past provider or helper metadata
- **THEN** secondary provider details and helper hints are visually subordinate to the start flow

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The app header MUST remain global and passive by keeping only application-level location, navigation, and passive runtime state visible, while workspace route switching and route-local actions stay inside the workspace shell or route surfaces.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the global header
- **THEN** the global app header does not repeat the workspace path or route-local notices already rendered inside the workspace shell

#### Scenario: Open global settings outside the workspace shell
- **WHEN** the user activates the global settings entry from application chrome
- **THEN** the application navigates to a dedicated global settings route
- **THEN** the route is not rendered inside the workspace shell tabs

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the passive global header and route region, and the workspace shell owns the workspace header, route content viewport, and conditional bottom navigation. Each layer MUST express only its own context facts without repeating identity or action in adjacent layers.

#### Scenario: Workspace route content is not wrapped by duplicate padding stacks
- **WHEN** a workspace route renders Chat, Devtools, or Settings content
- **THEN** the outer application shell does not inject a second competing content padding layer inside the workspace scaffold
- **THEN** the workspace route keeps visual priority over surrounding shell chrome

### Requirement: The application SHALL provide stable primary and secondary session navigation
The WebUI SHALL render a stable primary navigation that only exposes `Quick Start` and `Workspaces`, and it SHALL render running-session entry points through a secondary running-session section inside the application sidebar model instead of adding dynamic session shortcuts to the primary sidebar or header.

#### Scenario: Primary navigation stays fixed
- **WHEN** the application renders its global navigation
- **THEN** the primary sidebar shows `Quick Start` and `Workspaces` as the only primary entries

#### Scenario: Running sessions use a sidebar secondary section
- **WHEN** one or more sessions are running
- **THEN** the application exposes those sessions through a secondary running-session section in the sidebar on desktop and in the shared navigation drawer on mobile
- **THEN** the application does not add separate session shortcuts to the primary navigation or dedicate a header-only session switcher to them

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL keep one shared master-detail model for the `Workspaces ↔ Sessions` flow, while workspace `Chat`, `Devtools`, and `Settings` are rendered inside the workspace shell without duplicating outer page chrome or padding. The master-detail shell MUST preserve one explicit detail viewport instead of stacking hidden wrappers across desktop and compact layouts.

#### Scenario: Desktop keeps workspace-session split behavior
- **WHEN** the application is rendered on a desktop-sized viewport
- **THEN** the Workspaces view uses the shared resizable master-detail layout for workspace and session inspection

#### Scenario: Compact workspace selection opens the Sessions detail flow
- **WHEN** the application is rendered on a compact viewport and the user selects a workspace from the Workspaces list
- **THEN** the shared mobile detail flow opens the Sessions detail surface for that workspace
- **THEN** the user does not need a separate double-click or secondary activation gesture to inspect that workspace's sessions

#### Scenario: Master-detail detail pane keeps one scroll owner
- **WHEN** the desktop detail pane or compact sheet contains long content
- **THEN** the detail surface exposes one deliberate primary scroll viewport
- **THEN** outer master-detail wrappers do not clip or suppress that scrolling behavior

### Requirement: Chat route SHALL own the primary session action surface
The WebUI SHALL expose the active session's primary run control through the Chat route toolbar, and that surface SHALL use one state-driven action instead of separate Start and Stop actions in outer shell chrome.

#### Scenario: Chat toolbar renders one state-driven session control
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the Chat toolbar shows the session identity and one primary session action
- **THEN** the action label and enabled state reflect whether the session can currently be started or stopped

#### Scenario: Route-local notices stay in the Chat surface
- **WHEN** the active Chat route has a local notice such as missing terminal configuration or a route-specific runtime warning
- **THEN** the notice is rendered inside the Chat surface instead of the global app header

