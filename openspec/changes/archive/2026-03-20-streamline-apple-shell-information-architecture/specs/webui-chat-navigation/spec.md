## ADDED Requirements

### Requirement: Chat route SHALL own the primary session action surface
The WebUI SHALL expose the active session's primary run control through the Chat route toolbar, and that surface SHALL use one state-driven action instead of separate Start and Stop actions in outer shell chrome.

#### Scenario: Chat toolbar renders one state-driven session control
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the Chat toolbar shows the session identity and one primary session action
- **THEN** the action label and enabled state reflect whether the session can currently be started or stopped

#### Scenario: Route-local notices stay in the Chat surface
- **WHEN** the active Chat route has a local notice such as missing terminal configuration or a route-specific runtime warning
- **THEN** the notice is rendered inside the Chat surface instead of the global app header

## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. The app header MUST remain global and passive by keeping only application-level location, navigation, and passive runtime state visible, while workspace route switching and route-local actions stay inside the workspace shell or route surfaces.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the global app header does not repeat the workspace path or route-local notices already rendered inside the workspace shell

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell
- **THEN** the workspace shell remains the only route-switching surface for those tabs

#### Scenario: Compact header collapses to global navigation and passive status
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the route header keeps only the app-level location, passive connection or AI status, and the navigation drawer trigger visible
- **THEN** workspace tab switching remains in the bottom navigation and route-local session actions are not exposed through the app header

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the global header and route content region, and the workspace shell owns the workspace context bar, route-specific content, and mobile footer navigation. Each layer MUST express only its own navigation and context facts without repeating the same identity or action in adjacent layers.

#### Scenario: Desktop shell keeps navigation layers separated
- **WHEN** the application is rendered on a desktop-sized viewport inside a workspace route
- **THEN** the left application sidebar and main workspace shell are presented as distinct chrome layers
- **THEN** the workspace shell shows the workspace context and route tabs without repeating session controls that belong to the Chat surface

#### Scenario: Mobile shell reuses the navigation drawer
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the navigation drawer presents both primary navigation and running sessions
- **THEN** the workspace shell keeps its bottom navigation available as a dedicated footer inside the main shell instead of embedding it inside the content padding stack
