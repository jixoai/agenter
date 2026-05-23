## ADDED Requirements

### Requirement: cli-shell SHALL host terminal composition through tmux

cli-shell SHALL use tmux as its extension-local host and compositor. The tmux host SHALL create or attach one tmux session per cli-shell product session key, with one shell pane for user terminal work and one room pane for MessageRoom interaction.

#### Scenario: Attach starts a tmux session with shell and room panes

- **WHEN** a user runs `agenter shell --session=5 --avatar=bangeel`
- **THEN** cli-shell plans a tmux session for product session `shell-5`
- **AND** pane 0 runs the user's shell in the current workspace
- **AND** pane 1 runs `agenter-cli-shell room --session=5 --avatar=bangeel`
- **AND** the foreground process attaches to that tmux session

#### Scenario: Missing tmux fails clearly

- **GIVEN** the configured tmux executable is unavailable
- **WHEN** cli-shell attach mode starts
- **THEN** it exits with a clear tmux-required error
- **AND** it does not fall back to TerminalSystem `terminal-2`

### Requirement: cli-shell cleanup SHALL remove extension-owned tmux sessions

cli-shell cleanup SHALL be able to remove tmux sessions owned by cli-shell in addition to generic MessageRoom/runtime resources and legacy migration residue.

#### Scenario: Cleanup kills matching tmux session

- **GIVEN** a cli-shell tmux session exists for `shell-5`
- **WHEN** the user runs `agenter shell cleanup --session=5 --confirm`
- **THEN** cli-shell kills the matching tmux session
- **AND** cleanup reports the killed tmux session
