## ADDED Requirements

### Requirement: Terminal view components SHALL expose terminal-scoped permission requests

Terminal view components SHALL subscribe to live guard permission requests for the terminal instance they render. The subscription SHALL be terminal-id scoped and SHALL NOT require the host to hydrate all terminal approvals or reconstruct terminal authority from catalog state.

#### Scenario: Web terminal view receives only its terminal requests
- **WHEN** `web-terminal-view` renders terminal `T`
- **THEN** it subscribes to permission requests filtered to `terminalId=T`
- **THEN** permission requests for other terminals do not open inline approval UI inside this view

#### Scenario: Host can override permission UI
- **WHEN** a terminal-scoped permission request arrives
- **AND** the host provided `onRequestPermissions`
- **THEN** `web-terminal-view` calls that callback with the request facts
- **THEN** the host may render a custom approval surface without replacing TerminalSystem authority
- **THEN** the host cannot resolve the request by mutating component-local or app-local state alone

#### Scenario: Default Web approval view uses TopLayer
- **WHEN** a terminal-scoped permission request arrives
- **AND** no host callback handles it
- **THEN** `web-terminal-view` renders the default approval UI as an HTML-Popover TopLayer surface
- **THEN** the terminal remains visible behind the popover
- **THEN** Approve and Deny call TerminalSystem approval commands

#### Scenario: Native shell terminal view mirrors the same contract
- **WHEN** `shell-terminal-view` renders a cli-shell terminal in OpenTUI
- **THEN** it observes permission requests filtered to the rendered terminal id
- **THEN** it exposes a app customization callback equivalent to `onRequestPermissions`
- **THEN** its default approval UI renders in an OpenTUI TopLayer overlay
- **THEN** the overlay does not mutate terminal scrollback, shell truth, selection truth, or cli-shell managed state

#### Scenario: Permission request UI is not authority
- **WHEN** either terminal-view default approval UI is displayed
- **THEN** the component is only an affordance over TerminalSystem permission facts
- **THEN** it cannot approve, deny, or mint leases without calling the TerminalSystem authority command

#### Scenario: Non-cli-shell app can embed the same approval affordance
- **WHEN** a app without cli-shell managed/takeover semantics embeds `web-terminal-view` or `shell-terminal-view`
- **THEN** the component still observes guard permission requests for the rendered terminal id
- **THEN** the default or custom approval UI still calls TerminalSystem authority commands
- **THEN** the component does not require cli-shell managed labels, hosting attention, or app delegation state

#### Scenario: Terminal view receives coalesced request updates
- **WHEN** TerminalSystem reuses or refreshes an equivalent pending permission request
- **THEN** the terminal-view component updates the existing approval surface for that request
- **THEN** it does not stack duplicate TopLayer prompts for the same pending request id
