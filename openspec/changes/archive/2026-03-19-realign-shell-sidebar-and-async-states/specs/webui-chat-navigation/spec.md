## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. On compact viewports, the route header MUST stay compact by keeping only navigation/context affordances visible and moving route actions into overflow surfaces.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell

#### Scenario: Compact header collapses secondary actions
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the route header keeps navigation and context visible while session and route actions are exposed through overflow affordances instead of always-on header buttons

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the route-specific header and content region, and the workspace shell owns the route-specific content plus bottom navigation.

#### Scenario: Desktop shell keeps navigation layers separated
- **WHEN** the application is rendered on a desktop-sized viewport inside a workspace route
- **THEN** the left application sidebar and main workspace shell are presented as distinct chrome layers
- **THEN** running sessions are rendered inside the sidebar instead of a separate desktop rail

#### Scenario: Mobile shell reuses the navigation drawer
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the navigation drawer presents both primary navigation and running sessions
- **THEN** the workspace shell keeps its bottom navigation available inside the main shell

### Requirement: The application SHALL provide stable primary and secondary session navigation
The WebUI SHALL render a stable primary navigation that only exposes `Quick Start` and `Workspaces`, and it SHALL render running-session entry points through a secondary running-session section inside the application sidebar model instead of adding dynamic session shortcuts to the primary sidebar or header.

#### Scenario: Primary navigation stays fixed
- **WHEN** the application renders its global navigation
- **THEN** the primary sidebar shows `Quick Start` and `Workspaces` as the only primary entries

#### Scenario: Running sessions use a sidebar secondary section
- **WHEN** one or more sessions are running
- **THEN** the application exposes those sessions through a secondary running-session section in the sidebar on desktop and in the shared navigation drawer on mobile
- **THEN** the application does not add separate session shortcuts to the primary navigation or dedicate a header-only session switcher to them
