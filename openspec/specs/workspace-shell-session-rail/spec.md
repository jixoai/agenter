## Purpose

Define the workspace-shell running-session navigation contract for desktop and compact layouts.
## Requirements
### Requirement: Workspace shell SHALL expose running sessions through a secondary rail
The WebUI SHALL expose running sessions through a secondary running-session navigation section inside the application sidebar on desktop-sized viewports, and that sidebar SHALL also own global application entry points such as `GlobalSettings`. Those global entries MUST remain visually separate from current workspace-local route controls.

#### Scenario: Desktop shows running sessions in the sidebar
- **WHEN** one or more sessions are running or starting on a desktop-sized viewport
- **THEN** the application renders those sessions in a dedicated running-session section inside the left sidebar
- **THEN** activating one of those entries navigates to that session's workspace shell route

#### Scenario: Sidebar entries identify the session clearly
- **WHEN** a desktop running-session sidebar entry is rendered
- **THEN** it shows session identity, unread state, and workspace context needed to distinguish it from other running sessions while remaining visually compact

#### Scenario: Global settings stays in global navigation
- **WHEN** the application sidebar is rendered
- **THEN** the GlobalSettings entry appears in the sidebar's global-navigation section
- **THEN** that entry does not move into a workspace page header or other page-local chrome

### Requirement: Compact layouts SHALL expose running sessions through a header-driven switcher
The WebUI SHALL provide access to the same running sessions on compact layouts through the shared navigation drawer instead of a dedicated header-driven switcher. That drawer SHALL remain a global-navigation surface and MUST NOT duplicate workspace-local route tabs, session run controls, or the global-settings entry inside page-local headers.

#### Scenario: Mobile navigation drawer shows running sessions
- **WHEN** the user opens the navigation drawer on a mobile-sized viewport
- **THEN** the application presents the current running sessions in a dedicated section of that drawer
- **THEN** activating one of those entries navigates to that session's workspace shell route

#### Scenario: Mobile drawer avoids workspace-local duplication
- **WHEN** the user opens the navigation drawer while already inside a workspace route
- **THEN** the drawer shows only primary application navigation and running-session entry points
- **THEN** the drawer does not repeat `Chat`, `Devtools`, `Settings`, or Start/Stop session actions that belong to the workspace shell or Chat route

