## MODIFIED Requirements

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
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. The app header MUST remain global and passive by keeping only application-level location, navigation, and passive runtime state visible, while workspace route switching and route-local actions stay inside the workspace shell or route surfaces. The shell MUST preserve explicit overflow and background ownership so layout wrappers do not clip route content or inject competing surface fills by default.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the global header
- **THEN** the global app header does not repeat the workspace path or route-local notices already rendered inside the workspace shell

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell
- **THEN** each route keeps its own responsibility boundary, where `Chat` is conversation-first and `Devtools` is inspection-first
- **THEN** the workspace shell remains the only route-switching surface for those tabs

#### Scenario: Compact header collapses to global navigation and passive status
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the route header keeps only the app-level location, passive connection or AI status, and the navigation drawer trigger visible
- **THEN** workspace tab switching remains in the bottom navigation and route-local session actions are not exposed through the app header

#### Scenario: Shell layout does not clip the route viewport
- **WHEN** a workspace route renders long panel content inside the application shell
- **THEN** shell wrappers preserve sizing without becoming implicit clipping layers
- **THEN** the route content relies on its own primary scroll viewport

#### Scenario: Global shell stays stable during route-local hot updates
- **WHEN** a burst of route-local runtime updates affects the active session
- **THEN** the global shell chrome keeps its current location and passive status without rerendering unrelated route surfaces
- **THEN** only the route-local subscribers for the affected session update

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the global header and route content region, and the workspace shell owns the workspace context bar, route-specific content, and mobile footer navigation. Each layer MUST express only its own navigation and context facts without repeating the same identity or action in adjacent layers.

#### Scenario: Desktop shell keeps the conversation stage visually primary
- **WHEN** the application is rendered on a desktop-sized viewport inside a workspace route
- **THEN** the left application sidebar and main workspace shell are presented as distinct chrome layers
- **THEN** the workspace shell shows the workspace context and route tabs without repeating session controls that belong to the Chat surface
- **THEN** the workspace context remains visible in a compact supporting bar
- **THEN** the route surface keeps visual priority over workspace chrome, so Chat does not start below a large competing workspace card

#### Scenario: Mobile shell reuses the navigation drawer
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the navigation drawer presents both primary navigation and running sessions
- **THEN** the workspace shell keeps its bottom navigation available as a dedicated footer inside the main shell instead of embedding it inside the content padding stack

#### Scenario: Workspace and session facts are not repeated across shell layers
- **WHEN** the user views a workspace route on desktop or compact layouts
- **THEN** app identity, workspace identity, and route-local session state are each owned by a single shell layer
- **THEN** the header, workspace bar, and chat toolbar do not repeat the same workspace path, session name, or route title as competing chrome
