## ADDED Requirements

### Requirement: Terminal-view host adapters SHALL render terminal-2 without creating product truth

`shell-terminal-view` and `web-terminal-view` SHALL act as host adapters for terminal-2 final product screen when used by cli-shell. They SHALL render terminal-2 output and forward host events, but they SHALL NOT create accepted product chrome, shell scrollbar, shell selection, dialogue state, or cursor ownership as host-local terminal truth.

#### Scenario: Shell-terminal-view renders terminal-2 in native mode
- **WHEN** cli-shell runs in native mode
- **THEN** `shell-terminal-view` SHALL render terminal-2 final product screen into the native terminal host
- **AND** it SHALL NOT render only terminal-1 shell rows with separate native-only accepted product overlays

#### Scenario: Web-terminal-view renders terminal-2 in web mode
- **WHEN** cli-shell runs in `--web` mode
- **THEN** `web-terminal-view` SHALL render terminal-2 final product screen
- **AND** it SHALL NOT render a reduced Web-only product approximation

#### Scenario: Host adapter forwards events without owning region state
- **WHEN** a host adapter receives keyboard, mouse, wheel, drag, copy, or resize events
- **THEN** it SHALL forward those events into the terminal-2 event routing contract
- **AND** it SHALL NOT maintain independent shell or dialogue scroll, selection, cursor, or copy truth

### Requirement: Web-terminal-view SHALL support cli-shell E2E parity

When `web-terminal-view` hosts cli-shell terminal-2, it SHALL expose enough observable browser behavior for automated E2E to validate the same final product surface as native cli-shell.

#### Scenario: Browser can observe final product text
- **WHEN** browser E2E opens `cli-shell --web`
- **THEN** the browser surface SHALL expose observable final product text sufficient to verify shell output, dialogue content, and bottom/status chrome
- **AND** the test SHALL NOT rely on a separate debug-only DOM that differs from the rendered product screen

#### Scenario: Browser can drive product interactions
- **WHEN** browser E2E sends keyboard, mouse, wheel, drag, copy, or resize interactions to `cli-shell --web`
- **THEN** those interactions SHALL route through the same terminal-2 event contract used by native mode
- **AND** the resulting visible product changes SHALL match terminal-2 truth

#### Scenario: Web acceptance is not a substitute product
- **WHEN** a behavior passes in `cli-shell --web`
- **THEN** that pass SHALL be evidence for the shared terminal-2 product law
- **AND** it SHALL NOT be treated as evidence for a separate Web-only implementation path
