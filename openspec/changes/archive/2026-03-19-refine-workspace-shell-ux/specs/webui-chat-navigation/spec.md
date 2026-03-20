## ADDED Requirements

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the primary sidebar owns global navigation, the secondary rail owns running-session shortcuts, and the workspace shell owns the route-specific header, content region, and bottom navigation.

#### Scenario: Desktop shell keeps navigation layers separated
- **WHEN** the application is rendered on a desktop-sized viewport inside a workspace route
- **THEN** the primary sidebar, secondary session rail, and main workspace shell are presented as distinct chrome layers

#### Scenario: Mobile shell collapses secondary chrome
- **WHEN** the application is rendered on a compact viewport inside a workspace route
- **THEN** the running-session shortcuts move into compact header-driven navigation while the workspace shell keeps its bottom navigation available

## MODIFIED Requirements

### Requirement: The application SHALL provide stable primary and secondary session navigation
The WebUI SHALL render a stable primary navigation that only exposes `Quick Start` and `Workspaces`, and it SHALL render running-session entry points through a secondary session navigation surface instead of adding dynamic session shortcuts to the primary sidebar.

#### Scenario: Primary navigation stays fixed
- **WHEN** the application renders its global navigation
- **THEN** the primary sidebar shows `Quick Start` and `Workspaces` as the only primary entries

#### Scenario: Running sessions use secondary navigation
- **WHEN** one or more sessions are running
- **THEN** the application exposes those sessions through the secondary session navigation surface instead of adding new primary-sidebar entries

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL keep one shared master-detail model for the `Workspaces ↔ Sessions` flow, while workspace `Chat`, `Devtools`, and `Settings` are rendered inside the workspace shell without duplicating outer page chrome or padding.

#### Scenario: Desktop keeps workspace-session split behavior
- **WHEN** the application is rendered on a desktop-sized viewport and the user opens Workspaces
- **THEN** the Workspaces view uses the shared resizable master-detail layout for workspace and session inspection

#### Scenario: Mobile keeps workspace-session detail flow
- **WHEN** the application is rendered on a compact viewport and the user opens session details from Workspaces
- **THEN** the Sessions detail content is presented through the shared mobile detail flow
- **THEN** workspace shell routes still keep their own compact route chrome instead of reusing the Workspaces detail layout
