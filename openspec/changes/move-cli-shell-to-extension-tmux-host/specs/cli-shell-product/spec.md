## MODIFIED Requirements

### Requirement: Cli-shell SHALL bind one tmux host to one cli-shell app session

Cli-shell SHALL treat the user-launched process as one tmux-hosted app session. The app session includes one tmux shell pane, one tmux MessageRoom pane, one selected AvatarRuntime, and one durable app room. cli-shell SHALL NOT create TerminalSystem `terminal-1` or `terminal-2` resources for its active app surface.

#### Scenario: One shell launch attaches one tmux app session

- **WHEN** a user runs `agenter shell --session=1`
- **THEN** cli-shell attaches to tmux session `shell-1`
- **AND** it ensures the app MessageRoom for `shell-1`
- **AND** it ensures the selected AvatarRuntime
- **AND** it does not create a visible TerminalSystem app terminal

#### Scenario: TerminalSystem app roles are absent

- **WHEN** cli-shell completes attach bootstrap
- **THEN** no active bootstrap output exposes `terminal-1`
- **AND** no active bootstrap output exposes `terminal-2`
- **AND** no TerminalSystem metadata key such as `terminalRuntimeKind=composed` or `composedShellTerminalId` is written by cli-shell

### Requirement: Cli-shell SHALL keep MessageRoom as generic backend truth

Cli-shell SHALL keep its room backed by MessageSystem through generic app-extension APIs. tmux is only the local host for terminal composition and SHALL NOT become MessageRoom storage truth.

#### Scenario: Room pane uses generic room binding

- **WHEN** cli-shell starts the room pane
- **THEN** the room pane resolves the same cli-shell app room by generic app metadata
- **AND** it reads and writes room messages through MessageSystem APIs
