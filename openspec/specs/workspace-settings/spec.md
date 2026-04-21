# workspace-settings Specification

## Purpose
Define the durable workspace settings contract for both regular workspaces and the special global workspace rooted at `~/`.

## Requirements
### Requirement: Workspace settings SHALL remain workspace-scoped while global settings stay separate
The system SHALL keep settings inspection and per-layer editing scoped to a semantic workspace target, but the special global workspace rooted at `~/` SHALL be represented through that same workspace model instead of a separate global-settings route. In the active Svelte WebUI, `/avatars/settings` SHALL be the workspace settings workbench, while superadmin/profile administration SHALL live at the separate auxiliary route `/admin`. The response shape SHALL remain consistent across regular workspaces and the global workspace.

#### Scenario: Inspect workspace settings without a session
- **WHEN** a client requests workspace settings graph for a workspace path that has no active session
- **THEN** the server returns effective settings content, schema metadata, field provenance, and discovered workspace-scoped source layers for that workspace
- **THEN** the same route family works without requiring `sessionId`

#### Scenario: Open global workspace settings through the same model
- **WHEN** the client opens the special global workspace rooted at `~/` inside `/avatars/settings`
- **THEN** the server returns its settings graph through the same workspace-settings contract shape used for regular workspaces
- **THEN** the client does not need a separate global-settings endpoint shape

#### Scenario: Superadmin administration does not own workspace settings routing
- **WHEN** the operator needs superadmin session or profile management
- **THEN** the application navigates to `/admin`
- **THEN** workspace settings behavior remains owned by `/avatars/settings`

### Requirement: Workspace settings SHALL preserve per-layer editing semantics
The system SHALL expose individual settings layers with editability metadata, and it SHALL allow saving only editable shared or local layers while keeping the effective merged projection read-only. The layer details surface SHALL continue to provide synchronized `Source` and schema-driven `View` modes.

#### Scenario: Save an editable shared layer
- **WHEN** a client saves an editable shared settings layer for a workspace
- **THEN** the server persists that layer and returns refreshed effective graph data for the same workspace
- **THEN** the updated shared values are visible through the effective projection

#### Scenario: Save an editable local layer
- **WHEN** a client saves an editable local settings layer for a workspace or the global workspace
- **THEN** the server persists that local layer and returns refreshed effective graph data for the same workspace target
- **THEN** the updated local values only affect that machine-local layer

#### Scenario: Reject a readonly workspace layer save
- **WHEN** a client attempts to save a readonly settings layer for a workspace
- **THEN** the server rejects the save and reports that the layer is readonly

### Requirement: Workspace settings SHALL adapt layer detail presentation by viewport class
The WebUI SHALL present workspace setting layers as a split pane on expanded or landscape viewports and as a right-side detail sheet on compact or medium portrait viewports, and this rule SHALL apply to both regular workspaces and the global workspace rooted at `~/`.

#### Scenario: Desktop or landscape settings uses split layer detail
- **WHEN** the user opens workspace `Settings` on an expanded viewport or any landscape viewport and activates the `Layer Sources` view
- **THEN** the sources list and layer editor are visible side by side
- **THEN** selecting a source updates the in-page editor pane

#### Scenario: Portrait compact settings uses right-sheet layer detail
- **WHEN** the user opens workspace `Settings` on a compact or medium portrait viewport, activates `Layer Sources`, and selects a source
- **THEN** the layer editor opens in a right-side sheet
- **THEN** the sources list remains the primary in-page panel behind that sheet

### Requirement: Workspace settings SHALL expose provenance-aware source and view workbench modes
The active Svelte WebUI SHALL expose workspace settings through a source/view workbench that mirrors the effective graph and per-layer details, including provenance jumps from effective values back to source layers.

#### Scenario: Effective field jumps to source layer view
- **WHEN** the user activates a provenance target from an effective settings field
- **THEN** the workbench switches to the layer-sources flow for the mapped layer
- **THEN** the target layer opens directly in `View` mode with the mapped pointer focused

#### Scenario: Workspace rail and settings workbench stay in one route surface
- **WHEN** the user opens `/avatars/settings`
- **THEN** the page shows a workspace selector rail on the left and the selected workspace settings workbench on the right
- **THEN** switching workspaces refreshes the settings graph without leaving the settings route

### Requirement: Workspace settings SHALL inherit from the global workspace by default
Each non-global workspace SHALL inherit from the special global workspace rooted at `~/` by default, and the effective settings graph SHALL reflect that inherited base even when the explicit `extends` field remains hidden from first-slice UI.

#### Scenario: Workspace effective settings include inherited global values
- **WHEN** the user opens settings for a regular workspace with no explicit local override for a setting
- **THEN** the effective graph includes the value inherited from the global workspace
- **THEN** provenance for that field points back to the global workspace layer

#### Scenario: Local override masks inherited global value
- **WHEN** a workspace layer overrides a setting that is otherwise inherited from the global workspace
- **THEN** the effective graph shows the local value for that workspace
- **THEN** provenance shows the workspace layer as the winning source for that field

### Requirement: Workspace settings SHALL split shared settings from local secrets
Workspace settings SHALL store shared settings such as default avatars and workspace-visible defaults in `settings.json`, while sensitive machine-local data such as private keys, JWTs, and auth tokens SHALL be stored in workspace or global `settings.local.json`. Room and terminal truth, naming, membership, and permissions SHALL remain owned by their own global systems, and AvatarSession-scoped room or terminal credentials SHALL NOT be persisted in the workspace root settings files.

#### Scenario: Shared avatar and workspace defaults persist to settings.json
- **WHEN** the user saves default-avatar selection or other workspace-visible shared defaults from `Welcome`, `Avatars`, or `Settings`
- **THEN** the shared setting is written to the editable shared settings layer
- **THEN** another machine can consume that shared value without requiring local secret material

#### Scenario: Sensitive auth values persist to settings.local.json
- **WHEN** the user saves a private key, JWT, auth token, or other machine-local secret through the global workspace settings flow
- **THEN** the value is written to the editable local settings layer
- **THEN** the shared settings layer remains free of that sensitive value

### Requirement: Workspace settings SHALL exclude AvatarSession collaboration credentials
Room tokens and terminal tokens used by an AvatarSession SHALL NOT be persisted in the editable workspace or global `settings.local.json` root layer. Those credentials belong to the target Avatar seat and SHALL be resolved from avatar-local local files instead.

#### Scenario: Saving workspace local settings does not absorb room or terminal tokens
- **WHEN** the user saves the editable workspace or global `settings.local.json` layer
- **THEN** the persisted document excludes AvatarSession-scoped room and terminal credentials
- **THEN** those collaboration credentials continue to resolve from the target Avatar directory instead of the workspace root

### Requirement: Browser-facing workspace settings SHALL require authenticated superadmin authority
Workspace settings SHALL remain readable without an active runtime session for the target workspace, but browser-facing settings inspection and mutation SHALL require an authenticated superadmin browser session.

#### Scenario: Anonymous browser cannot inspect workspace settings
- **WHEN** a browser caller requests workspace settings graph or layer content without a valid superadmin browser auth session
- **THEN** the daemon rejects the request with an authorization failure
- **THEN** sessionless settings inspection does not imply anonymous browser access

#### Scenario: Superadmin can inspect and edit workspace settings without a runtime session
- **WHEN** a superadmin browser caller requests workspace settings for a workspace path that has no active runtime session
- **THEN** the daemon returns the normal workspace-settings contract shape for that workspace
- **THEN** the operator can continue using the same sessionless settings workflow after authentication
