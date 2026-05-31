## MODIFIED Requirements

### Requirement: Terminal-view components SHALL project permission requests for the opened terminal

`web-terminal-view` and `shell-terminal-view` SHALL render permission requests for the terminal id they are currently opened on. Approval actions SHALL preserve that TerminalSystem terminal id and request id. Hosts SHALL fix wrong terminal targeting before data reaches the component rather than asking one opened terminal viewport to render requests for unrelated terminals.

#### Scenario: Permission projection stays terminal-local
- **WHEN** a host embeds `web-terminal-view` or `shell-terminal-view` with terminal id `T`
- **THEN** the component renders permission requests for terminal `T`
- **AND** it ignores permission requests for unrelated terminals

#### Scenario: Custom permission callback handles opened-terminal request
- **WHEN** a host provides `onRequestPermissions`
- **AND** the callback handles a request for the opened terminal
- **THEN** the component suppresses the default approval UI for that request
- **AND** the host callback still must approve or deny through TerminalSystem authority

#### Scenario: Default approval UI stays TopLayer projection
- **WHEN** no custom callback handles a pending permission request
- **THEN** `web-terminal-view` renders its default HTML Popover TopLayer approval UI
- **AND** `shell-terminal-view` renders its default OpenTUI TopLayer approval overlay
- **AND** neither component mutates terminal scrollback, selection truth, app hosting state, or write leases locally
