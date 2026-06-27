## ADDED Requirements

### Requirement: Background close SHALL preserve the attached terminal binding

When a user chooses `Run in Background`, shell-next SHALL close the current UI attachment without stopping the daemon-owned PTY or turning the attached terminal into dead history.

#### Scenario: Background close preserves the attached terminal
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Run in Background`
- **THEN** shell-next exits the UI
- **AND** the attached terminal source is not terminated
- **AND** app-bound live sources may dispose their local mirror/transport so the shell-next process can exit
- **AND** the same terminal remains available on the next attach

#### Scenario: Background close does not perform terminate cleanup
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user chooses `Run in Background`
- **THEN** shell-next does not run the terminate path
- **AND** it does not kill the underlying PTY

### Requirement: App command foreground exit SHALL NOT stop daemon-owned resources

Shell-next app commands SHALL run against a managed daemon authority whose lifecycle is independent from the foreground shell-next process.

#### Scenario: Foreground shell-next process exits while daemon resources remain live
- **GIVEN** a app command launch needs daemon-backed shell-next resources
- **WHEN** the launcher ensures a managed daemon authority
- **AND** the foreground shell-next process exits after a background close
- **THEN** the launcher does not stop the daemon
- **AND** daemon-owned TerminalSystem entries remain live and selectable on the next attach

### Requirement: Terminal termination SHALL remain destructive

When a user chooses `Terminate terminal`, shell-next SHALL stop the attached terminal and close the UI.

#### Scenario: Terminate kills the attached terminal
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Terminate terminal`
- **THEN** shell-next runs the terminal source terminate path
- **AND** the underlying PTY is killed
- **AND** the UI exits

### Requirement: Shell-next terminal input ownership SHALL stay below the app layer

Shell-next SHALL keep terminal-specific input semantics inside the terminal source/backend boundary. ShellNextApp and view code SHALL only perform app-global routing, focus orchestration, raw pointer/keyboard forwarding, and visual projection.

#### Scenario: Terminal semantic input does not live in ShellNextApp
- **WHEN** shell-next handles normal terminal key input, paste input, selection movement, or viewport-follow behavior
- **THEN** the durable behavior is owned by the terminal source/backend boundary
- **AND** ShellNextApp only routes the input to that boundary

#### Scenario: App-global shortcuts remain above the terminal boundary
- **WHEN** the user presses `Ctrl+B`, `Help`, `Chat`, or top-layer close keys
- **THEN** shell-next handles them as app-global actions
- **AND** it does not move those shortcuts into the terminal kernel boundary
