## MODIFIED Requirements

### Requirement: TerminalSystem SHALL not own cli-shell tmux pane topology

TerminalSystem SHALL remain a terminal system app with its own terminal instances and contracts. cli-shell's tmux shell pane, room pane, and tmux session topology SHALL remain extension-local state and SHALL NOT be represented as TerminalSystem `terminal-1`, `terminal-2`, or composed app-terminal roles.

#### Scenario: cli-shell tmux session is not a TerminalSystem terminal pair

- **WHEN** cli-shell starts a tmux session
- **THEN** TerminalSystem does not create a paired `terminal-1` and `terminal-2`
- **AND** TerminalSystem does not receive composed cli-shell app chrome metadata
- **AND** any TerminalSystem terminal created elsewhere remains independent from cli-shell

#### Scenario: TerminalSystem composed-surface API is not cli-shell runtime truth

- **WHEN** cli-shell renders or attaches its tmux session
- **THEN** it does not publish `AppTerminalComposedSurfaceState`
- **AND** TerminalSystem snapshots do not become the canonical tmux screen state
