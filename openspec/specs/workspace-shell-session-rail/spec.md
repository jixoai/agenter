# workspace-shell-session-rail Specification

## Purpose

Define the durable secondary running-avatar navigation contract for desktop and compact application shells.

## Requirements

### Requirement: Workspace shell SHALL expose running sessions through nested secondary navigation

The WebUI SHALL expose running avatars as secondary navigation nested under the primary `Avatars` shell entry, and each entry SHALL identify the avatar, its workspace context, unread state, and runtime status without being promoted into the primary navigation set.

#### Scenario: Desktop shows running avatars under Avatars

- **WHEN** one or more avatars are running on a desktop-sized viewport and the operator is inside `Avatars`
- **THEN** the application renders them as nested secondary navigation under the `Avatars` entry inside the shared navigation shell
- **THEN** activating one of those entries opens the corresponding running-avatar detail shell

#### Scenario: Nested entries identify avatar and workspace clearly

- **WHEN** a running-avatar nested entry is rendered
- **THEN** it shows the avatar identity, workspace context, unread state, and runtime status needed to distinguish it from other entries
- **THEN** the entry stays visually compact enough to remain a secondary navigation surface

#### Scenario: Active entry does not reorder the list

- **WHEN** the operator opens one running avatar from the nested secondary navigation
- **THEN** the active entry gains selection styling without being moved to the front of the running-avatar list
- **THEN** the surrounding running-avatar order remains stable until the underlying session catalog changes

### Requirement: Compact layouts SHALL expose running sessions through the shared navigation drawer

Compact layouts SHALL expose the same running avatars through the shared navigation drawer or compact secondary navigation surface instead of inventing a different primary-navigation shortcut model. That surface SHALL remain distinct from workspace-local tabs and route-local actions.

#### Scenario: Mobile navigation drawer shows running avatars

- **WHEN** the user opens the navigation drawer on a mobile-sized viewport while inside `Avatars`
- **THEN** the application presents the current running avatars as nested secondary navigation under the `Avatars` entry
- **THEN** activating one of those entries opens the corresponding running-avatar detail shell

#### Scenario: Mobile secondary navigation avoids workspace-local duplication

- **WHEN** the user opens compact navigation while already inside `Avatars` or a running-avatar detail shell
- **THEN** the drawer keeps running avatars attached to the `Avatars` navigation branch instead of promoting them to peer primary entries
- **THEN** it does not duplicate route-local runtime actions
