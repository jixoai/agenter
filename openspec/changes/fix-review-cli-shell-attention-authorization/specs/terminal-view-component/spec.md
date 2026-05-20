## ADDED Requirements

### Requirement: Terminal-view components SHALL render authorization actions without owning authority

Terminal view components SHALL be able to render pending terminal authorization actions for the terminal they are opened on. Components SHALL expose callbacks for approve, deny, cancel, and optional denial reason collection, but they MUST NOT own TerminalSystem action state, write leases, or attention commits locally.

#### Scenario: Component renders only opened-terminal action
- **WHEN** a terminal-view component is opened on terminal `T`
- **THEN** it renders pending authorization actions for terminal `T`
- **AND** it ignores pending actions for unrelated terminal ids

#### Scenario: Component callback preserves action identity
- **WHEN** a user approves, denies, or cancels a rendered authorization action
- **THEN** the callback includes the terminal id and terminal action id
- **AND** the host can call the generic TerminalSystem mutation without reconstructing identity from UI labels

#### Scenario: Default UI stays a projection
- **WHEN** no custom host callback handles a pending authorization action
- **THEN** `web-terminal-view` may render a default HTML Popover TopLayer
- **AND** `shell-terminal-view` may render a default OpenTUI TopLayer overlay
- **AND** neither default UI mutates terminal scrollback, terminal selection, managed hosting state, or write authority locally

#### Scenario: Custom UI suppresses default projection only
- **WHEN** a host-provided `onRequestPermissions` or equivalent callback handles an action
- **THEN** the terminal-view component suppresses its default popup for that action
- **AND** the host remains responsible for calling TerminalSystem authority APIs

