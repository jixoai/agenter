## ADDED Requirements

### Requirement: Cli-shell SHALL render native and web hosts from the same terminal-2 product screen

Cli-shell SHALL make native mode and `--web` mode render the same terminal-2 final product screen. `--web` SHALL be an equivalent host for the cli-shell product surface, not a shell-only, reduced, or debugging-only projection.

#### Scenario: Native and web show the same product screen
- **GIVEN** native cli-shell and `cli-shell --web` attach to the same product session
- **WHEN** terminal-2 publishes the final product screen
- **THEN** both hosts render the same shell content, dialogue state, bottom/status chrome, cursor ownership, selection visuals, and layout state from terminal-2 truth
- **AND** neither host supplies an accepted product state that the other host cannot observe

#### Scenario: Web mode is suitable for product E2E
- **WHEN** browser-driven E2E opens `cli-shell --web`
- **THEN** it can verify the same final product behaviors expected in native mode
- **AND** it does not need a separate Web-only acceptance target that differs from Ghostty native behavior

#### Scenario: Web mode does not attach directly to shell-only truth
- **WHEN** `cli-shell --web` starts
- **THEN** it binds to terminal-2 final product screen truth
- **AND** it does not render terminal-1 directly as the official product surface

### Requirement: Cli-shell SHALL model terminal-chat as an independent OpenTUI dialogue backend

Cli-shell SHALL model terminal-chat as an independent OpenTUI dialogue backend that owns dialogue message layout, scrollBox offset, cursor, selection, copy, wrapping, and focus through the shared offscreen renderer/event-bridge law. Terminal-chat SHALL NOT rely on a native PTY scrollback to provide dialogue interaction semantics, and the MVP SHALL NOT replace terminal-chat backend ownership with hand-rolled dialogue selection/copy/wrap algorithms.

#### Scenario: Dialogue scroll uses OpenTUI scrollBox truth
- **WHEN** dialogue content exceeds its visible area
- **THEN** terminal-chat SHALL manage the visible dialogue position through OpenTUI scrollBox state
- **AND** it SHALL NOT use native PTY scrollback as the dialogue scroll truth

#### Scenario: Dialogue backend is independent in MVP
- **WHEN** cli-shell implements terminal-chat for this change
- **THEN** terminal-chat SHALL be an independent OpenTUI backend instance
- **AND** cli-shell SHALL reuse the same offscreen renderer/event-bridge law that is being hardened for shell projection
- **AND** terminal-2 SHALL NOT substitute a local dialogue interaction algorithm for that backend

#### Scenario: Dialogue owns selection and copy
- **WHEN** the user drags to select text inside the dialogue region
- **THEN** terminal-chat SHALL own the selected range and copy extraction for dialogue content
- **AND** shell selection SHALL NOT include dialogue cells
- **AND** terminal-2 SHALL NOT calculate the dialogue selection range as a separate replacement algorithm

#### Scenario: Dialogue owns input cursor and wrapping
- **WHEN** the dialogue input is focused and the user types or pastes content
- **THEN** terminal-chat SHALL own input cursor movement and wrapping
- **AND** shell terminal cursor truth SHALL NOT be reused as dialogue input cursor truth

#### Scenario: Dialogue scrollbar can be hidden without losing scroll
- **WHEN** cli-shell configures terminal-chat offscreen renderer with hidden scrollbar chrome
- **THEN** the dialogue frame SHALL omit visual scrollbar cells
- **AND** terminal-chat SHALL still preserve scrollBox offset, viewport, selection, copy, cursor, and wrapping truth

### Requirement: Cli-shell shell offscreen renderer SHALL own shell scrollbar focus selection cursor and wrapping

Cli-shell SHALL render shell content through a shell offscreen renderer that owns shell scrollbar, focus, selection, cursor, and wrapping as part of the same rendered shell frame. Terminal-2 SHALL compose this complete shell frame and MUST NOT reconstruct those concerns as external product decorations.

#### Scenario: Shell renderer emits complete shell frame
- **WHEN** terminal-1 shell truth is projected into the cli-shell product screen
- **THEN** the shell offscreen renderer SHALL emit one frame containing shell cells, shell scrollbar, shell focus, shell selection, shell cursor, and shell wrapping
- **AND** terminal-2 SHALL place that complete frame without splitting shell interaction visuals into separate owner state

#### Scenario: Shell selection does not cross into dialogue
- **WHEN** the user drags to select shell content
- **THEN** shell selection SHALL remain owned by the shell offscreen renderer
- **AND** it SHALL NOT cross into dialogue, bottom/status chrome, or terminal-chat selection ownership

#### Scenario: Shell scrollbar interaction returns through shell owner
- **WHEN** the user wheels, drags, or clicks the shell scrollbar
- **THEN** cli-shell SHALL route that event to the shell owner path
- **AND** the visible result SHALL return through the next terminal-2 final product screen

### Requirement: Cli-shell SHALL keep terminal roles precise

Cli-shell SHALL preserve three distinct backend roles: terminal-1 as the PTY-backed shell backend, terminal-chat as the OpenTUI dialogue backend, and terminal-2 as the composed final product terminal backend. The product SHALL NOT collapse these roles into one terminal identity or split them into host-local visible truths.

#### Scenario: Terminal-1 remains shell PTY truth
- **WHEN** shell commands run inside cli-shell
- **THEN** terminal-1 SHALL own the shell PTY, raw bytes, shell buffer, shell cursor, shell viewport, and AI observation source
- **AND** terminal-chat and terminal-2 SHALL NOT pretend to be the shell PTY

#### Scenario: Terminal-chat remains dialogue truth
- **WHEN** dialogue content, selection, scroll, cursor, wrapping, or copy state changes
- **THEN** terminal-chat SHALL own that dialogue state
- **AND** terminal-1 shell PTY scrollback SHALL NOT be used as dialogue truth

#### Scenario: Terminal-2 remains final product truth
- **WHEN** cli-shell publishes visible output for native or Web hosts
- **THEN** terminal-2 SHALL own the final composed product screen
- **AND** native and Web hosts SHALL render terminal-2 rather than assembling their own accepted product surface
