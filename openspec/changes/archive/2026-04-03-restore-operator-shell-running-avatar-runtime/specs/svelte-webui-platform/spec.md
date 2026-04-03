## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation
The top-level WebUI shell SHALL organize navigation around orthogonal systems, not around the old session-first route hierarchy. The active Svelte shell SHALL expose primary routes for `Workspaces`, `History`, `Messages`, `Terminals`, and `Settings`, and it SHALL also expose a secondary `Running Avatars` rail that opens the running-avatar detail shell without mutating the primary destination set.

#### Scenario: Primary navigation
- **WHEN** the operator opens the WebUI
- **THEN** the primary shell exposes dedicated entry points for workspaces, message-system, terminal-system, history, and global settings/profile

#### Scenario: Secondary runtime navigation
- **WHEN** one or more avatars are running
- **THEN** the shell exposes them in a dedicated `Running Avatars` section outside the primary destination set
- **THEN** activating one of those entries opens the running-avatar detail shell instead of changing the primary navigation model

#### Scenario: Route ownership
- **WHEN** a system surface or running-avatar detail surface is rendered
- **THEN** its route layout owns local navigation and state without depending on React-era shell contracts
