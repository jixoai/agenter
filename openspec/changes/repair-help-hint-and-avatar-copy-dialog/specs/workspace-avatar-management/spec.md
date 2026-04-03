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

#### Scenario: Copy dialog submits reliably
- **GIVEN** the operator opened the `Copy avatar` dialog and entered a valid target nickname
- **WHEN** the operator activates the primary submit action with pointer or keyboard
- **THEN** the system submits the copy exactly once
- **THEN** the dialog closes after success
- **THEN** the newly created avatar becomes the selected avatar in the visible catalog
