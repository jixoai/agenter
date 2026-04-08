## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation
The top-level WebUI shell SHALL expose only `Avatars`, `Messages`, and `Terminals` as primary destinations. The shell SHALL expose `/admin` only through the footer superadmin affordance, and running avatars SHALL appear as dynamic tabs inside the Avatars workbench instead of a separate primary destination, global top bar, or secondary rail card. The shell SHALL NOT inject a redundant top header or refresh-only control above the currently selected workbench window.

#### Scenario: Primary shell exposes exactly three destinations
- **WHEN** the operator opens the WebUI
- **THEN** the left primary navigation shows only `Avatars`, `Messages`, and `Terminals`
- **THEN** neither global settings nor running avatars are promoted into that primary destination set

#### Scenario: Superadmin uses the footer auxiliary route
- **WHEN** the operator needs global administration
- **THEN** they enter `/admin` from the footer superadmin affordance
- **THEN** the application does not add a fourth primary destination for that workflow

#### Scenario: Selected workbench owns local chrome
- **WHEN** the operator switches to a primary destination
- **THEN** the selected workbench renders its own title, metadata, and local actions inside its window chrome
- **THEN** there is no redundant global top bar or manual refresh button rendered above that workbench

## ADDED Requirements

### Requirement: Workbench routes SHALL provide objective workspace path presentation
Workspace-aware workbench surfaces SHALL present the global workspace as `~/.agenter`, SHALL use compact objective labels for dense navigation surfaces, and SHALL use the full objective path for detail titles. Compact workspace labels in tabs, rails, and summary chrome SHALL use the final two path segments when more than two segments exist.

#### Scenario: Global workspace uses the objective home-relative form
- **WHEN** a workspace-aware surface renders the special global workspace rooted at `~/`
- **THEN** the visible label is `~/.agenter`
- **THEN** the UI does not replace that objective path with subjective titles such as `Global workspace`

#### Scenario: Dense navigation uses compact objective paths
- **WHEN** a workbench list or tab renders a regular workspace path such as `/Users/kzf/Dev/GitHub/jixoai-labs/agenter`
- **THEN** the dense navigation label is shown as `jixoai-labs/agenter`
- **THEN** the detail title for the selected workspace still uses the full objective path

### Requirement: Workbench window chrome SHALL expose shared sidebar visibility control
Each selected primary workbench window SHALL expose a local sidebar visibility control through shared workbench chrome so desktop and compact operators can collapse or expand the left shell without reintroducing a global shell header.

#### Scenario: Desktop workbench can collapse the application sidebar
- **WHEN** the operator is viewing a primary workbench on a desktop-sized viewport
- **THEN** the workbench chrome exposes a sidebar collapse control
- **THEN** activating that control toggles the left application shell without depending on a separate global header

#### Scenario: Compact workbench still exposes the navigation trigger
- **WHEN** the operator is viewing a primary workbench on a compact viewport
- **THEN** the workbench chrome exposes the same shared navigation trigger
- **THEN** the operator can reopen the shell without leaving the current workbench
