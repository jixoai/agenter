## ADDED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL expose a route-aware app header plus a bottom navigation on mobile-first layouts.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`

#### Scenario: Switch workspace shell tabs
- **WHEN** the user activates `Chat`, `Devtools`, or `Settings` from the workspace shell navigation
- **THEN** the application navigates to the corresponding workspace route without leaving the workspace shell

## MODIFIED Requirements

### Requirement: Quick Start is a primary application view
The WebUI SHALL expose Quick Start as a dedicated primary view that is separate from Workspaces and the workspace shell, and it SHALL provide the current workspace controls and recent session entry points needed to start work immediately.

#### Scenario: No active session opens on Quick Start
- **WHEN** the application opens without an active session selected
- **THEN** the main content shows the Quick Start view instead of a workspace shell or empty Chat view

#### Scenario: Quick Start shows recent sessions
- **WHEN** recent sessions are available for the selected workspace context
- **THEN** Quick Start shows up to three recent session entries that can be used to resume work

### Requirement: The application SHALL provide stable primary and dynamic chat navigation
The WebUI SHALL render a stable primary navigation that only exposes `Quick Start` and `Workspaces`, and workspace/session entry points SHALL be reached from those views instead of from dynamic global session shortcuts.

#### Scenario: Primary navigation stays workspace-first
- **WHEN** the application renders its global sidebar
- **THEN** the sidebar shows `Quick Start` and `Workspaces` as the only primary application entries

#### Scenario: Opening a session does not add a global shortcut
- **WHEN** a session is opened or resumed
- **THEN** the application does not add a new global sidebar shortcut for that session

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL keep one shared master-detail model for the `Workspaces ↔ Sessions` view, while workspace `Chat`, `Devtools`, and `Settings` are presented through the workspace shell routes instead of the old global Chat/Settings split.

#### Scenario: Desktop keeps workspace-session split behavior
- **WHEN** the application is rendered on a desktop-sized viewport and the user opens Workspaces
- **THEN** the Workspaces view uses the shared resizable master-detail layout for workspace and session inspection

#### Scenario: Mobile keeps workspace-session detail sheet behavior
- **WHEN** the application is rendered on a compact viewport and the user opens session details from Workspaces
- **THEN** the Sessions detail content is presented through the shared mobile detail flow

## REMOVED Requirements

### Requirement: Workspace and session entries SHALL share one interaction contract
**Reason**: Workspace entries remain the launch surface, but session access now lives inside workspace-scoped routes and notification-aware actions instead of one global interaction contract.
**Migration**: Validate workspace and session interactions through the new Workspaces view and workspace shell behaviors.
