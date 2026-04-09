## REMOVED Requirements

### Requirement: Workspaces SHALL expose hierarchical avatar catalogs
**Reason**: Avatar definitions are globalized and are no longer modeled as workspace-local overlay catalogs.
**Migration**: Consume the global avatar catalog and expose workspace-specific behavior through WorkspaceSystem mounts and workspace public/private assets instead of workspace-local avatar copies.

### Requirement: Editing a global-source avatar inside a workspace SHALL fork by full copy
**Reason**: Workspaces no longer own avatar definitions through overlay copies.
**Migration**: Keep avatar definitions in the global avatar catalog and store workspace-specific assets in workspace public or avatar-private roots.

### Requirement: Avatar actions SHALL create or focus one session per workspace and avatar pair
**Reason**: Runtime identity is no longer derived from the workspace/avatar pair.
**Migration**: Resolve or start one canonical AvatarRuntime per Avatar, then attach or detach workspaces as runtime mounts.

## MODIFIED Requirements

### Requirement: Avatar management SHALL define a default avatar contract
The system SHALL define `default` as the default avatar nickname in the global avatar catalog, and its canonical directory SHALL resolve to `~/.agenter/avatars/default`. The default avatar SHALL remain permanently visible as the blank starting point for global avatar selection and workspace mounting flows.

#### Scenario: No explicit avatar falls back to default
- **WHEN** the user opens Avatar selection without any explicit avatar choice stored yet
- **THEN** the UI and runtime model use `default` as the selected avatar nickname
- **AND** the resolved avatar directory points to `~/.agenter/avatars/default`

#### Scenario: Default avatar stays visible as a launch seed
- **WHEN** the user opens the global `Avatars` workbench
- **THEN** the `default` avatar is visible even if it has never been customized
- **AND** the user can use it as the blank starting point for a runtime or workspace-mount flow

### Requirement: Avatar-scoped collaboration credentials SHALL live inside the target avatar directory
Room and terminal credentials for an Avatar SHALL be persisted in that Avatar's directory rather than in workspace root settings layers. For a regular workspace this file SHALL resolve under `<workspace>/.agenter/avatars/<avatar>/settings.local.json`; for the global avatar directory it SHALL resolve under `~/.agenter/avatars/<avatar>/settings.local.json`.

#### Scenario: Regular workspace stores seat credentials under the workspace avatar-private directory
- **WHEN** a regular workspace Avatar receives or refreshes a room token or terminal token
- **THEN** the system writes that credential into `<workspace>/.agenter/avatars/<avatar>/settings.local.json`
- **AND** another workspace using the same Avatar can keep a different workspace-local seat credential

#### Scenario: Global avatar stores credentials under the global avatar directory
- **WHEN** the global avatar directory receives or refreshes a room token or terminal token for an Avatar
- **THEN** the system writes that credential into `~/.agenter/avatars/<avatar>/settings.local.json`
- **AND** the credential remains attached to that Avatar instead of leaking into workspace root settings files

#### Scenario: Invalid credential is retained with an invalid marker
- **WHEN** a stored room token or terminal token fails validation
- **THEN** the system keeps that stored credential record in place instead of deleting it automatically
- **AND** the same avatar-local file records that seat as `credential-invalid` until a fresh credential replaces it

## ADDED Requirements

### Requirement: Avatar catalog SHALL be global and workspace-independent
The system SHALL expose one global Avatar catalog and SHALL not require regular workspaces to own copied Avatar definitions before those Avatars can mount or operate in the workspace.

#### Scenario: Workspace consumes a global Avatar without local definition
- **WHEN** a regular workspace grants access to a global Avatar that has no workspace-local avatar directory yet
- **THEN** the Avatar can still mount that workspace and operate there
- **AND** workspace-specific data is stored in workspace public or avatar-private roots rather than in a workspace-local avatar definition copy
