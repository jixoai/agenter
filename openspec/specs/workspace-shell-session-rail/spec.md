# workspace-shell-session-rail Specification

## Purpose
Define the durable secondary running-avatar navigation contract for desktop and compact application shells.

## Requirements

### Requirement: Workspace shell SHALL expose running sessions through a secondary rail
The WebUI SHALL expose running avatars through a secondary navigation rail inside the application shell, and each entry SHALL identify the avatar, its workspace context, unread state, and runtime status without being promoted into the primary navigation set.

#### Scenario: Desktop shows running avatars in the secondary rail
- **WHEN** one or more avatars are running on a desktop-sized viewport
- **THEN** the application renders them in a dedicated `Running Avatars` section inside the shared navigation shell
- **THEN** activating one of those entries opens the corresponding running-avatar detail shell

#### Scenario: Secondary rail entries identify avatar and workspace clearly
- **WHEN** a running-avatar rail entry is rendered
- **THEN** it shows the avatar identity, workspace context, unread state, and runtime status needed to distinguish it from other entries
- **THEN** the entry stays visually compact enough to remain a secondary navigation surface

### Requirement: Compact layouts SHALL expose running sessions through a header-driven switcher
Compact layouts SHALL expose the same running avatars through the shared navigation drawer or compact secondary navigation surface instead of inventing a different primary-navigation shortcut model. That surface SHALL remain distinct from workspace-local tabs and route-local actions.

#### Scenario: Mobile navigation drawer shows running avatars
- **WHEN** the user opens the navigation drawer on a mobile-sized viewport
- **THEN** the application presents the current running avatars in a dedicated secondary section of that drawer
- **THEN** activating one of those entries opens the corresponding running-avatar detail shell

#### Scenario: Mobile secondary navigation avoids workspace-local duplication
- **WHEN** the user opens compact navigation while already inside `Workspaces` or a running-avatar detail shell
- **THEN** the drawer shows primary destinations plus `Running Avatars`
- **THEN** it does not duplicate workspace-local tabs such as `Settings` or `Avatars`, and it does not duplicate route-local runtime actions
