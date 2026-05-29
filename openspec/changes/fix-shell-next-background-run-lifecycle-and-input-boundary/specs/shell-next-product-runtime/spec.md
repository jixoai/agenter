## ADDED Requirements

### Requirement: Background close SHALL preserve the attached terminal binding

When a user chooses `Run in Background`, shell-next SHALL close the current UI without disposing the attached terminal source or turning the attached terminal into dead history.

#### Scenario: Background close preserves the attached terminal
- **GIVEN** a product-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Run in Background`
- **THEN** shell-next exits the UI
- **AND** the attached terminal source is not terminated
- **AND** product-bound live sources may detach their view transport so the shell-next process can exit
- **AND** the same terminal remains available on the next attach

#### Scenario: Background close does not perform terminate cleanup
- **GIVEN** a product-bound terminal pane is open
- **WHEN** the user chooses `Run in Background`
- **THEN** shell-next does not run the terminate path
- **AND** it does not kill the underlying PTY

### Requirement: Terminal termination SHALL remain destructive

When a user chooses `Terminate terminal`, shell-next SHALL stop the attached terminal and close the UI.

#### Scenario: Terminate kills the attached terminal
- **GIVEN** a product-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Terminate terminal`
- **THEN** shell-next runs the terminal source terminate path
- **AND** the underlying PTY is killed
- **AND** the UI exits

### Requirement: Shell-next terminal input ownership SHALL stay below the app layer

Shell-next SHALL keep terminal-specific input semantics inside the terminal source/backend boundary. ShellNextApp and view code SHALL only perform product-global routing, focus orchestration, raw pointer/keyboard forwarding, and visual projection.

#### Scenario: Terminal semantic input does not live in ShellNextApp
- **WHEN** shell-next handles normal terminal key input, paste input, selection movement, or viewport-follow behavior
- **THEN** the durable behavior is owned by the terminal source/backend boundary
- **AND** ShellNextApp only routes the input to that boundary

#### Scenario: Product-global shortcuts remain above the terminal boundary
- **WHEN** the user presses `Ctrl+B`, `Help`, `Chat`, or top-layer close keys
- **THEN** shell-next handles them as product-global actions
- **AND** it does not move those shortcuts into the terminal kernel boundary
