## MODIFIED Requirements

### Requirement: Web chat view SHALL expose a rich shared composer surface

The shared chat package SHALL render a responsive CodeMirror-based composer surface with attachment previews, action/status toolbars, help hints, and host-driven send orchestration instead of a minimal textarea-only input.

#### Scenario: Host-managed send keeps the host hint text
- **WHEN** the host supplies its own send handler for a room/chat surface
- **THEN** the shared composer renders the host-provided hint text as-is
- **THEN** transport-only copy such as `Waiting for channel transport` does not override that host-managed hint
