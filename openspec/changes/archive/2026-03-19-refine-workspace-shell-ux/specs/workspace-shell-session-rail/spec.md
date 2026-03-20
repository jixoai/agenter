## ADDED Requirements

### Requirement: Workspace shell SHALL expose running sessions through a secondary rail
The WebUI SHALL render a secondary session rail for running sessions on desktop-sized viewports, and that rail SHALL provide direct entry into the selected session's workspace shell without adding dynamic items to the primary sidebar.

#### Scenario: Desktop shows running sessions in a secondary rail
- **WHEN** one or more sessions are running or starting on a desktop-sized viewport
- **THEN** the application renders those sessions in a dedicated rail between the primary sidebar and the main content area
- **THEN** activating a rail entry navigates to that session's workspace shell route

#### Scenario: Session rail entries identify the session clearly
- **WHEN** a running-session rail entry is rendered
- **THEN** it shows the session name or fallback label, the `sessionId`, and workspace context needed to distinguish it from other running sessions

### Requirement: Compact layouts SHALL expose running sessions through a header-driven switcher
The WebUI SHALL provide access to the same running sessions on compact layouts through a header-driven switcher or sheet instead of a permanent desktop rail.

#### Scenario: Mobile opens running session switcher
- **WHEN** the user opens the compact running-session navigation affordance on a mobile-sized viewport
- **THEN** the application presents the current running sessions in a compact overlay surface
- **THEN** activating one of those entries navigates to that session's workspace shell route
