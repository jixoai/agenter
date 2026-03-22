## ADDED Requirements

### Requirement: Structured inspection values SHALL default to YAML-first previews
The WebUI SHALL render structured inspection payloads through a lightweight structured viewer that defaults to a highlighted YAML preview while preserving access to raw JSON representations.

#### Scenario: Structured fact opens in YAML preview by default
- **WHEN** Devtools renders a structured cycle fact without a local viewer override
- **THEN** the fact preview uses the `highlight-yaml` mode by default
- **THEN** the structured preview does not require a `CodeMirror` instance

### Requirement: Structured viewer SHALL expose local and global render modes from one menu
The structured viewer SHALL expose both the current-view render mode and the global default render mode from a menu-owned control surface.

#### Scenario: Menu changes local and global modes independently
- **WHEN** the user opens a structured viewer menu
- **THEN** the menu exposes one control for the current viewer mode and one control for the global default mode
- **THEN** changing the current viewer mode does not change other viewers unless the global default is also changed
