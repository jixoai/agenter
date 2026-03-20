## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. The app header MUST remain global and passive by keeping only application-level location, navigation, and passive runtime state visible, while workspace route switching and route-local actions stay inside the workspace shell or route surfaces. The shell MUST preserve explicit overflow and background ownership so layout wrappers do not clip route content or inject competing surface fills by default.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the global header

#### Scenario: Shell layout does not clip the route viewport
- **WHEN** a workspace route renders long panel content inside the application shell
- **THEN** shell wrappers preserve sizing without becoming implicit clipping layers
- **THEN** the route content relies on its own primary scroll viewport

#### Scenario: Global shell stays stable during route-local hot updates
- **WHEN** a burst of route-local runtime updates affects the active session
- **THEN** the global shell chrome keeps its current location and passive status without rerendering unrelated route surfaces
- **THEN** only the route-local subscribers for the affected session update
