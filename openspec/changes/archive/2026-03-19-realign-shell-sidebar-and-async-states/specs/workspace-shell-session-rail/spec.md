## MODIFIED Requirements

### Requirement: Workspace shell SHALL expose running sessions through a secondary rail
The WebUI SHALL expose running sessions through a secondary running-session navigation section inside the application sidebar on desktop-sized viewports, and that section SHALL provide direct entry into the selected session's workspace shell without adding dynamic items to the primary navigation.

#### Scenario: Desktop shows running sessions in the sidebar
- **WHEN** one or more sessions are running or starting on a desktop-sized viewport
- **THEN** the application renders those sessions in a dedicated running-session section inside the left sidebar
- **THEN** activating one of those entries navigates to that session's workspace shell route

#### Scenario: Sidebar entries identify the session clearly
- **WHEN** a desktop running-session sidebar entry is rendered
- **THEN** it shows session identity, unread state, and workspace context needed to distinguish it from other running sessions while remaining visually compact

### Requirement: Compact layouts SHALL expose running sessions through a header-driven switcher
The WebUI SHALL provide access to the same running sessions on compact layouts through the shared navigation drawer instead of a dedicated header-driven switcher.

#### Scenario: Mobile navigation drawer shows running sessions
- **WHEN** the user opens the navigation drawer on a mobile-sized viewport
- **THEN** the application presents the current running sessions in a dedicated section of that drawer
- **THEN** activating one of those entries navigates to that session's workspace shell route
