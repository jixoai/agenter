## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts. The app header MUST remain globally passive, the workspace shell MUST keep workspace context compact, and route-local actions or notices MUST stay inside the active route surface instead of being duplicated in outer shell chrome.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the global header

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell
- **THEN** each route keeps its own responsibility boundary, where `Chat` is conversation-first and `Devtools` is inspection-first

#### Scenario: Compact header stays passive
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the app header keeps only application-level location, passive runtime status, and the navigation drawer trigger visible
- **THEN** workspace-local notices or debugging actions are not exposed through the compact header

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the global header and content region, and the workspace shell owns a compact workspace context bar, the route surface, and mobile footer navigation. Adjacent layers MUST NOT repeat the same workspace identity, session status, or technical inspection content.

#### Scenario: Desktop shell keeps the conversation stage visually primary
- **WHEN** the application is rendered on a desktop-sized viewport inside a workspace route
- **THEN** the workspace context remains visible in a compact supporting bar
- **THEN** the route surface keeps visual priority over workspace chrome, so Chat does not start below a large competing workspace card

#### Scenario: Mobile shell reuses the navigation drawer
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the navigation drawer presents primary navigation and running sessions
- **THEN** the workspace shell keeps its own bottom navigation footer without duplicating route-local actions or technical panels in the drawer
