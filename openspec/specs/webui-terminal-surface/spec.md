# webui-terminal-surface Specification

## Purpose
TBD - created by archiving change propagate-terminal-contract-to-clients. Update Purpose after archive.
## Requirements
### Requirement: WebUI terminal and devtools surfaces SHALL consume the runtime terminal contract directly
WebUI terminal-facing surfaces SHALL render from `focusedTerminalIds` and explicit terminal representation metadata instead of relying on legacy diff aliases or app-server-specific shims, and the standalone workspace `Terminals` route SHALL reuse that same direct contract.

#### Scenario: Workspace terminals route renders from focused terminal ids
- **WHEN** the user opens the workspace `Terminals` route
- **THEN** the route reuses the terminal panel that derives its visible terminal selection from `focusedTerminalIds`
- **THEN** it does not rely on a secondary Systems-only embedding path to function

#### Scenario: Standalone terminal route keeps activity inspection
- **WHEN** the standalone terminal route renders terminal activity and latest read output
- **THEN** it uses the existing session/terminal paging contract and representation metadata
- **THEN** the route does not fork a second terminal activity model separate from the existing terminal atom

