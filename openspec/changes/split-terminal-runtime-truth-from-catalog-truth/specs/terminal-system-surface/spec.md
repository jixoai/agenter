## MODIFIED Requirements

### Requirement: Terminal-system SHALL present global terminals as a standalone product surface

The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, renders the selected terminal transcript, and provides lifecycle-aware actions without reconstructing terminal identity from stale catalog fields.

#### Scenario: Selected terminal page owns the page-toolbar

- **WHEN** the operator opens a concrete shared terminal route
- **THEN** the toolbar identity resolves from `observed title ?? configured title ?? terminal id`
- **AND** the toolbar second line prefers runtime observed current path instead of fixed launch cwd
- **AND** if no runtime path is available, the route falls back to terminal id or nothing rather than pretending launch cwd is current path

#### Scenario: Toolbar status reflects lifecycle plus activity

- **WHEN** the selected terminal route renders
- **THEN** the toolbar status shows process lifecycle facts such as `Provisioned`, `Running`, or `Stopped`
- **AND** running terminals may additionally show `Busy` or `Idle`
- **AND** stopped terminals show stop-reason detail such as `Killed`, `Exited`, or `Failed`

#### Scenario: Actions reflect explicit lifecycle operations

- **WHEN** a terminal is `running`
- **THEN** the route exposes `Kill PTY` as the lifecycle action and keeps `Delete terminal` separate as the destructive catalog action

#### Scenario: Stopped route stays open

- **WHEN** the operator stops a terminal PTY
- **THEN** the route stays on that terminal and disables read/write surfaces until bootstrap
- **AND** only deleting the terminal removes it from the route/catalog
