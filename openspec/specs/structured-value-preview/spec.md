# structured-value-preview Specification

## Purpose
TBD - created by archiving change stabilize-chat-devtools-performance-and-inspector-previews. Update Purpose after archive.
## Requirements
### Requirement: Structured inspection values SHALL default to YAML-first previews
The WebUI SHALL render structured inspection payloads through a WebUI-native structured viewer that defaults to a highlighted YAML preview while preserving access to formatted JSON and raw text representations.

#### Scenario: Structured fact opens in YAML preview by default
- **WHEN** Devtools renders a structured cycle fact without a local viewer override
- **THEN** the fact preview uses the `highlight-yaml` mode by default
- **THEN** the structured preview renders through the shared read-only CodeMirror viewer pipeline

### Requirement: Structured viewer SHALL expose local and global render modes from one menu
The structured viewer SHALL expose both the current-view render mode and the global default render mode from a standard menu-owned control surface that matches the WebUI dropdown-menu law.

#### Scenario: Menu changes local and global modes independently
- **WHEN** the user opens a structured viewer menu
- **THEN** the menu exposes one control for the current viewer mode and one control for the global default mode
- **THEN** changing the current viewer mode does not change other viewers unless the global default is also changed

