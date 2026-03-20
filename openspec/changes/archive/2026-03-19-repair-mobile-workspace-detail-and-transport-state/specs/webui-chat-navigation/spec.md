## MODIFIED Requirements

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model

The WebUI SHALL keep one shared master-detail model for the `Workspaces ↔ Sessions` flow, while workspace `Chat`, `Devtools`, and `Settings` are rendered inside the workspace shell without duplicating outer page chrome or padding.

#### Scenario: Desktop keeps workspace-session split behavior

- **WHEN** the application is rendered on a desktop-sized viewport
- **THEN** the Workspaces view uses the shared resizable master-detail layout for workspace and session inspection

#### Scenario: Compact workspace selection opens the Sessions detail flow

- **WHEN** the application is rendered on a compact viewport and the user selects a workspace from the Workspaces list
- **THEN** the shared mobile detail flow opens the Sessions detail surface for that workspace
- **THEN** the user does not need a separate double-click or secondary activation gesture to inspect that workspace's sessions
