# webui-terminal-surface Specification

## Purpose
TBD - created by archiving change propagate-terminal-contract-to-clients. Update Purpose after archive.
## Requirements
### Requirement: WebUI terminal and devtools surfaces SHALL consume the runtime terminal contract directly
WebUI terminal-facing surfaces SHALL render from `focusedTerminalIds` and explicit terminal representation metadata instead of relying on legacy diff aliases or app-server-specific shims.

#### Scenario: Terminal panel renders from focused terminal ids
- **WHEN** the WebUI terminal panel receives runtime state with multiple focused terminal ids
- **THEN** the panel derives its visible terminal selection from that set
- **THEN** it does not require a legacy single-focus-only contract to function

#### Scenario: Devtools distinguishes diff and snapshot reads
- **WHEN** a terminal read result is rendered in Devtools
- **THEN** the surface can distinguish diff vs snapshot output from explicit representation metadata
- **THEN** the rendered affordance does not depend on legacy tool names such as `terminal_consumeDiff`

