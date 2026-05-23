## MODIFIED Requirements

### Requirement: Runtime terminal publications SHALL support product TUI projections over TerminalSystem truth

Runtime terminal publications SHALL expose enough TerminalSystem truth for local and remote product TUIs to render current terminal state, send input, inspect output, and react to lifecycle or authorization changes without reconstructing terminal truth locally. Product TUIs SHALL consume these publications as projections and SHALL NOT become terminal truth owners.

#### Scenario: Product TUI hydrates terminal from runtime publication
- **WHEN** cli-shell opens a bound terminal surface
- **THEN** it can hydrate terminal snapshot, lifecycle, status, transport, cursor, and renderer facts from runtime/client SDK publications
- **AND** the terminal id in those publications remains the TerminalSystem id
- **AND** cli-shell does not need a tmux-private shell pane to be the terminal source

#### Scenario: Product TUI input targets the bound terminal
- **WHEN** a user or Avatar sends terminal input through cli-shell
- **THEN** the input is submitted to the bound TerminalSystem terminal id through the runtime terminal contract
- **AND** the effect is recorded as TerminalSystem activity with actor/authorization provenance

### Requirement: Runtime terminal context SHALL be explicit enough for Avatar model rounds

When a product binds a terminal to an AvatarRuntime, runtime model context SHALL be able to identify the current bound terminal and room through product context or attention/projection facts. The model SHALL NOT need to infer current product terminal identity from stale global terminal catalog rows.

#### Scenario: Avatar sees current cli-shell binding
- **WHEN** a cli-shell room message asks the Avatar to operate the terminal
- **THEN** model-visible context or discoverable runtime facts identify the current cli-shell product resource key and bound TerminalSystem terminal id
- **AND** the Avatar does not choose another terminal solely because it appears focused or stale in `terminal list`

#### Scenario: Stale terminal residue is not the product binding
- **GIVEN** old cli-shell terminals remain in the global terminal catalog
- **WHEN** the Avatar handles a fresh cli-shell session
- **THEN** runtime context distinguishes historical catalog rows from the current product binding
- **AND** the Avatar's terminal operation targets the current bound terminal id
