## MODIFIED Requirements

### Requirement: Workspaces SHALL expose hierarchical avatar catalogs
The Workspaces surface SHALL expose Avatar catalogs through the special global workspace and through regular workspaces, and regular workspace views SHALL distinguish global-source avatars from workspace-local copied avatars. The visible catalog SHALL stay synchronized with copy actions and server-published avatar catalog invalidation events.

#### Scenario: Regular workspace shows global-source and local copied avatars together
- **WHEN** the user opens the avatar catalog for a regular workspace
- **THEN** the surface lists both global-source avatars and workspace-local copied avatar entries in one coherent catalog
- **THEN** the user can tell which entries still point at the global source and which are local copies inside the current workspace

#### Scenario: Copy action appears immediately
- **WHEN** the user copies an avatar from the workspace catalog
- **THEN** the copied avatar appears in the visible catalog immediately without a manual page refresh
- **THEN** the selection can move directly to the new avatar before the next route reload

### Requirement: Editing a global-source avatar inside a workspace SHALL fork by full copy
When the user edits or copies a global-source avatar from inside a regular workspace, the system SHALL first create a full workspace-local copy and SHALL then apply future workspace-local edits to that copied avatar.

#### Scenario: Editing global-source avatar creates a workspace copy first
- **WHEN** the user opens a global-source avatar in a regular workspace and chooses to edit it
- **THEN** the system creates a full workspace-local copy of that avatar before the edit is applied
- **THEN** later edits in that workspace mutate the copied avatar rather than the global source

#### Scenario: Copy survives refresh
- **WHEN** the browser refreshes after a workspace-local avatar copy was created
- **THEN** the copied avatar remains visible in the workspace catalog
- **THEN** the catalog still resolves that avatar as a workspace-local copy rather than a transient optimistic row
