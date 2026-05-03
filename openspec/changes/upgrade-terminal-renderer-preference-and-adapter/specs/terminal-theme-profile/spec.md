## ADDED Requirements

### Requirement: Terminal profiles SHALL expose durable theme identity

Terminal profiles SHALL expose durable terminal theme identity owned by terminal-system rather than feature-local background styling.

#### Scenario: Terminal config exposes theme identity
- **WHEN** a caller reads durable terminal configuration
- **THEN** the profile includes the terminal theme identity needed for viewport and host theme resolution
- **AND** the theme identity is not reconstructed from feature-local CSS heuristics

### Requirement: Terminal viewport hosts SHALL consume resolved terminal theme tokens

Terminal viewport hosts and viewport adapters SHALL consume resolved terminal theme tokens from one shared theme law.

#### Scenario: Terminal window body background uses theme background
- **WHEN** the terminal surface renders terminal-window body chrome
- **THEN** the visible terminal body background uses resolved terminal theme background
- **AND** the surface does not render an unrelated feature-local gradient in place of terminal theme background

#### Scenario: Viewport renderer background stays aligned with host body background
- **WHEN** the viewport renderer paints terminal background for the same terminal theme
- **THEN** the viewport background and terminal-window body background resolve from the same terminal theme law
- **AND** the two surfaces do not drift into different background colors for the same terminal
