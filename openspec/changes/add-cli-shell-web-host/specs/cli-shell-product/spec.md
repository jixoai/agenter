## MODIFIED Requirements

### Requirement: Cli-shell SHALL support explicit product host modes over one backend terminal truth

Cli-shell SHALL support native-host and Web-host product modes over the same product/bootstrap law. Host-mode selection changes the projection host for terminal-2, not the attached room, runtime, terminal-1 shell truth, or terminal-2 product-terminal truth.

#### Scenario: Default launch keeps native host mode
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell launches its native host mode
- **AND** product bootstrap still binds terminal-1 shell truth, terminal-2 final product-terminal truth, one room, and one AvatarRuntime

#### Scenario: Web flag launches browser host mode
- **WHEN** a user runs `agenter shell --web`
- **THEN** cli-shell launches a browser-facing host mode for the same product
- **AND** it prints the resolved local URL for that shell session
- **AND** host-mode selection does not create a second product identity

#### Scenario: Web host mode does not create a second terminal truth
- **WHEN** cli-shell starts in Web host mode
- **THEN** it projects the same terminal-2 product-terminal truth governed by terminal-system contracts
- **AND** it does not create a second PTY, second scrollback truth, or second viewport truth for that same shell session
- **AND** it does not bypass terminal-2 by attaching the browser directly to terminal-1 shell truth

### Requirement: Cli-shell Web host SHALL present a shell-only browser surface

When cli-shell runs in Web host mode, the browser page SHALL present a shell-only first viewport. It MAY include minimal semantic scaffolding required for sizing and focus, but it SHALL NOT add extra host chrome by default.

#### Scenario: Browser page renders only the shell surface
- **WHEN** a browser opens the URL served by `agenter shell --web`
- **THEN** the first viewport renders the shell surface for terminal-2
- **AND** it does not render extra headers, sidebars, debug panes, terminal catalogs, or explanatory product chrome by default

#### Scenario: Browser shell remains terminal-first
- **WHEN** the Web host is visible
- **THEN** keyboard input targets the shell surface by default
- **AND** the host does not replace the shell with a dashboard or inspector-first composition
