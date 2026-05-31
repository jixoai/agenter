## ADDED Requirements

### Requirement: App terminal binding SHALL carry backend launch truth independently from renderer preference

The app-extension runtime SHALL let app packages provide an explicit terminal `backend` field when ensuring a terminal binding. That field is durable launch truth owned by terminal-system, not a browser renderer preference, not a app-local alias, and not an implicit consequence of `processKind`.

#### Scenario: Cli-shell requests ghostty-native through generic terminal binding
- **WHEN** cli-shell runs `ensureTerminalBinding` for `shell-1` with `backend = ghostty-native`
- **THEN** the app-extension runtime forwards that backend field through the generic terminal binding path
- **AND** the binding contract remains generic rather than adding a cli-shell-specific method

#### Scenario: Reuse path patches stopped terminal backend through generic config mutation
- **GIVEN** terminal `shell-1` already exists with durable backend `xterm`
- **AND** that terminal is `not_started` or `stopped`
- **WHEN** cli-shell ensures the same binding with `backend = ghostty-native`
- **THEN** the app-extension runtime updates durable backend launch truth through the terminal owner's generic config mutation path
- **AND** the next bootstrap uses `ghostty-native`

#### Scenario: Running backend mismatch is surfaced to the app
- **GIVEN** terminal `shell-1` is already running with durable backend `xterm`
- **WHEN** cli-shell ensures the same binding with `backend = ghostty-native`
- **THEN** the app-extension runtime reports a backend-mismatch style failure back to cli-shell
- **AND** it does not silently attach as xterm
- **AND** it does not hide the mismatch by rewriting renderer preference

#### Scenario: Omitted backend preserves owner-side defaulting
- **WHEN** a app ensures a terminal binding without specifying `backend`
- **THEN** the app-extension runtime leaves backend defaulting to terminal-system
- **AND** it does not infer a backend from browser renderer or app metadata
