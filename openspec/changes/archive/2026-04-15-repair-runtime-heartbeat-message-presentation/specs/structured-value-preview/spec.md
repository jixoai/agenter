## MODIFIED Requirements

### Requirement: Structured viewer SHALL expose local and global render modes from one menu

The structured viewer SHALL expose both the current-view render mode and the global default render mode from a menu-owned control surface. A viewer without a local override SHALL immediately track global mode updates, while a local override SHALL remain ephemeral to the mounted DOM instance and reset on remount.

#### Scenario: Menu changes local and global modes independently
- **WHEN** the user opens a structured viewer menu
- **THEN** the menu exposes one control for the current viewer mode and one control for the global default mode
- **THEN** changing the current viewer mode does not change other viewers unless the global default is also changed

#### Scenario: Global mode update refreshes non-overridden viewer immediately
- **WHEN** the user changes `All viewers` on one structured viewer
- **THEN** any mounted structured viewer without a local override updates immediately to the new global mode
- **AND** a viewer with a local override keeps its local mode until its DOM instance is destroyed
