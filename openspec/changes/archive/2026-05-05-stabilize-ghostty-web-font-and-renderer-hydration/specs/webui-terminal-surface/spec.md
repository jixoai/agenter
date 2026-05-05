## MODIFIED Requirements

### Requirement: WebUI terminal and devtools surfaces SHALL consume the runtime terminal contract directly

WebUI terminal-facing surfaces SHALL render from global terminal ids, actor-scoped focused terminal sets, title/status metadata, explicit terminal representation metadata, durable renderer preference, resolved renderer facts, and durable theme metadata instead of relying on legacy session-private or renderer-private host assumptions.

#### Scenario: Terminals page renders from global terminal ids
- **WHEN** the user opens the top-level `Terminals` page
- **THEN** the page derives its visible terminal selection from the shared global terminal contract
- **THEN** it does not require a session-private terminal route to function

#### Scenario: Terminal-facing views keep activity inspection
- **WHEN** the terminal surface renders terminal activity and latest read output
- **THEN** it uses the existing paging contract plus explicit representation metadata
- **THEN** the route does not fork a second terminal activity model

#### Scenario: Terminal surface resolves auto renderer preference locally
- **WHEN** the selected terminal carries `rendererPreference = auto`
- **THEN** the WebUI surface resolves that preference through the front-end renderer resolver
- **AND** current desktop WebUI resolves it to `ghostty-web`

#### Scenario: Terminal host does not depend on renderer-private selectors
- **WHEN** the terminal route renders or tests viewport focus, sizing, or interaction
- **THEN** it uses public viewport facts and shared adapter-owned behavior
- **AND** it does not depend on `.xterm-*` selectors or xterm-private metric objects

#### Scenario: Experimental renderers are labeled in config UI
- **WHEN** the operator opens the terminal presentation config dialog
- **THEN** stable renderer entries such as `Auto`, `Ghostty Web`, and `XTerm` are listed plainly
- **AND** `wterm` is labeled as experimental rather than being presented as an equally stable renderer path
