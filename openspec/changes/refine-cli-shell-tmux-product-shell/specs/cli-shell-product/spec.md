## MODIFIED Requirements

### Requirement: Cli-shell SHALL preserve product shell chrome while using tmux as host

Cli-shell SHALL remain a tmux-hosted extension product, but tmux hosting SHALL include the cli-shell product shell chrome. The visible shell surface SHALL keep a bottom status bar, mouse-operable Help and Chat entries, and keyboard shortcuts even when the Chat room is not currently visible. Cli-shell SHALL keep this tmux product shell isolated from core TerminalSystem and from the user's default tmux server.

#### Scenario: Shell-first attach still exposes Chat and status

- **WHEN** a user runs `agenter shell --session=5 --avatar=bangeel`
- **THEN** the user lands in the primary shell pane
- **AND** the bottom status bar identifies cli-shell, session, Avatar, managed state, and Chat entry
- **AND** Chat can be opened from the status-advertised key without replacing the shell pane
- **AND** a mouse user can click Help to discover the keyboard and mouse controls

#### Scenario: Product tmux state does not leak

- **WHEN** cli-shell installs status actions and key bindings
- **THEN** it installs them in the cli-shell-owned tmux socket namespace
- **AND** it does not write cli-shell product bindings into the user's default tmux server
