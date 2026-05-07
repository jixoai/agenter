## MODIFIED Requirements

### Requirement: Workspace CLI helpcenter SHALL expose one grouped command catalog per workspace lens

The platform SHALL expose one structured workspace CLI catalog for the current workspace/avatar lens. That catalog SHALL include `just-bash` builtins, descriptor-backed runtime CLI commands, and callable workspace tool commands, and it SHALL group those commands by their shell surface instead of mixing them into one flat undifferentiated list.

Each browser-visible catalog row SHALL also expose a `suggestedCommand`. A row MAY expose `preferredExecutionSurface` when the correct browser execution surface is not just “the current workspace shell.”

#### Scenario: Root/runtime rows declare browser execution surface explicitly

- **WHEN** the browser reads one root runtime CLI row such as `message send`
- **THEN** that row includes a `suggestedCommand` such as `message send --help`
- **AND** it includes `preferredExecutionSurface = "root-workspace"`

#### Scenario: Workspace tool rows stay on public-workspace

- **WHEN** the browser reads one workspace tool row such as `tool_review`
- **THEN** that row includes a `suggestedCommand` such as `tool_review --help`
- **AND** it includes `preferredExecutionSurface = "public-workspace"`

#### Scenario: Builtins inherit the current workspace shell surface

- **WHEN** the browser reads one builtin row such as `pwd`
- **THEN** that row still includes a `suggestedCommand`
- **AND** the row is not required to restate a surface that already comes from the current workspace lens
