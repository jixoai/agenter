# workspace-avatar-management Specification

## Purpose
Define the durable avatar catalog, copy, default-avatar, and session-identity rules for `Workspaces`.

## Requirements

### Requirement: Workspaces SHALL expose hierarchical avatar catalogs
The Workspaces surface SHALL expose Avatar catalogs through the special global workspace and through regular workspaces, and regular workspace views SHALL distinguish global-source avatars from workspace-local copied avatars.

#### Scenario: Regular workspace shows global-source and local copied avatars together
- **WHEN** the user opens the `Avatars` tab for a regular workspace
- **THEN** the surface lists both global-source avatars and workspace-local copied avatar entries in one coherent catalog
- **THEN** the user can tell which entries still point at the global source and which are local copies inside the current workspace

#### Scenario: Global workspace owns the canonical avatar catalog
- **WHEN** the user opens the global workspace rooted at `~/` and enters `Avatars`
- **THEN** the surface shows the canonical global avatar catalog
- **THEN** changes made there remain the baseline source for future workspace copies

### Requirement: Editing a global-source avatar inside a workspace SHALL fork by full copy
When the user edits a global-source avatar from inside a regular workspace, the system SHALL first create a full workspace-local copy and SHALL then apply the edit to that copied avatar.

#### Scenario: Editing global-source avatar creates a workspace copy first
- **WHEN** the user opens a global-source avatar in a regular workspace and chooses to edit it
- **THEN** the system creates a full workspace-local copy of that avatar before the edit is applied
- **THEN** later edits in that workspace mutate the copied avatar rather than the global source

### Requirement: Avatar management SHALL define a default avatar contract
The system SHALL define `default` as the default avatar nickname, and its default directory SHALL resolve to `.agenter/avatar/default` within the relevant source root. The default avatar SHALL remain permanently visible as the blank starting point for copy and creation flows.

#### Scenario: No explicit avatar falls back to default
- **WHEN** the user opens `Welcome` or `Avatars` without any explicit avatar selection stored yet
- **THEN** the UI and settings model use `default` as the selected avatar nickname
- **THEN** the resolved avatar directory points to `.agenter/avatar/default`

#### Scenario: Default avatar stays visible as a copy seed
- **WHEN** the user opens the `Avatars` tab
- **THEN** the `default` avatar is visible even if it has never been customized
- **THEN** the user can use it as the blank source for a copy or create flow

### Requirement: Avatar actions SHALL create or focus one session per workspace and avatar pair
The Workspaces surface SHALL treat `workspace + avatar` as the unique active-session identity when the user launches an avatar from `Welcome` or `Avatars`, and that identity SHALL map to one stable session id.

#### Scenario: Launching a stopped avatar creates one session
- **WHEN** the user launches an avatar that has no active session in the current workspace
- **THEN** the system creates one new session for that `workspace + avatar` pair
- **THEN** the running-avatar surfaces show exactly one new runtime entry for that launch

#### Scenario: Launching the same avatar again focuses the existing session
- **WHEN** the user launches the same avatar again in the same workspace while a session already exists
- **THEN** the system focuses the existing session instead of creating a second one
- **THEN** the workspace and running-avatar views do not show duplicate runtime entries for that pair

#### Scenario: Stable session id is reused for the same pair
- **WHEN** the system resolves the session identity for the same `workspace + avatar` pair more than once
- **THEN** it reuses the same deterministic UUID-shaped session id for that pair
- **THEN** session storage remains globally discoverable without inventing a second identity for the same running avatar

#### Scenario: Renaming the avatar creates a new session identity
- **WHEN** the avatar nickname changes in a way that changes the `workspace + avatar` pair identity
- **THEN** the system treats that launch target as a new session identity
- **THEN** it does not reuse the prior session id under the old avatar nickname

### Requirement: Avatar-scoped collaboration credentials SHALL live inside the target avatar directory
Room and terminal credentials for an AvatarSession SHALL be persisted in the local file that belongs to that Avatar seat rather than in the workspace root settings layer. For a regular workspace this file SHALL resolve under `<workspace>/.agenter/avatar/<avatar>/settings.local.json`; for the special global workspace rooted at `~/` it SHALL resolve under `~/.agenter/avatar/<avatar>/settings.local.json`.

#### Scenario: Regular workspace stores seat credentials under the workspace avatar directory
- **WHEN** a regular workspace AvatarSession receives or refreshes a room token or terminal token
- **THEN** the system writes that credential into `<workspace>/.agenter/avatar/<avatar>/settings.local.json`
- **THEN** another workspace using the same visible avatar name can keep a different seat credential

#### Scenario: Global workspace stores seat credentials under the global avatar directory
- **WHEN** the global workspace rooted at `~/` receives or refreshes a room token or terminal token for an Avatar
- **THEN** the system writes that credential into `~/.agenter/avatar/<avatar>/settings.local.json`
- **THEN** the credential remains attached to that global Avatar seat instead of leaking into a workspace root settings file

#### Scenario: Global-source avatar can still gain a workspace-local credential file
- **WHEN** a regular workspace launches a global-source Avatar without first forking its shared definition
- **THEN** the system MAY still create `<workspace>/.agenter/avatar/<avatar>/settings.local.json` for that session actor
- **THEN** the shared Avatar definition can remain inherited from the global source while the collaboration credential stays workspace-local

#### Scenario: Invalid credential is retained with an invalid marker
- **WHEN** a room token or terminal token stored in the avatar-local `settings.local.json` fails validation
- **THEN** the system keeps that stored credential record in place instead of deleting it automatically
- **THEN** the same avatar-local file records that seat as `credential-invalid` until a fresh credential replaces it
