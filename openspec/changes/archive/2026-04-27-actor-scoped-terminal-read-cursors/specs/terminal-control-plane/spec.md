## MODIFIED Requirements

### Requirement: Terminal control plane SHALL expose read-only inspection without implicit grant side effects

The terminal control plane SHALL expose `terminal_read` and `terminal_snapshot` as inspection operations over authorized terminals. Inspection MUST NOT create a hidden trusted bootstrap grant, mutate terminal access control, or auto-start a stopped terminal.

#### Scenario: Read-only inspection does not create bootstrap access

- **WHEN** a caller inspects a terminal through a read-only or bootstrap-free authorization path
- **THEN** the control plane returns the authorized snapshot or read result
- **AND** the control plane does not create or refresh a trusted bootstrap grant as a side effect
- **THEN** catalog access state changes only through explicit grant or lifecycle operations

### Requirement: Terminal read cursors SHALL be actor-scoped

Terminal output SHALL remain a shared physical fact, but git-log/diff read progress SHALL be owned by the reading actor. A consuming terminal read MUST advance only that actor's read cursor and MUST NOT consume output for other actors or terminal seats.

#### Scenario: Two actors consume the same diff independently

- **WHEN** two actors share one git-log backed terminal and both have read access
- **AND** one actor consumes a terminal diff
- **THEN** the other actor can still consume that same diff from their own read cursor
- **AND** the first actor's next read starts from the cursor advanced by their own consuming read

#### Scenario: Seat tokens resolve the reader actor

- **WHEN** a caller reads a terminal through a terminal access token
- **THEN** the read cursor is keyed by the token grant's participant actor
- **AND** a token-backed read does not fall back to a terminal-global cursor

#### Scenario: Non-consuming inspection preserves read progress

- **WHEN** a caller reads a terminal with `remark = false`
- **THEN** the returned payload may describe the actor's current read cursor
- **AND** the durable read cursor for that actor is not advanced

### Requirement: Terminal observation activity SHALL be caller controlled

Terminal read cursor consumption and terminal activity recording are separate controls. Cursor consumption SHALL be controlled by `remark`; activity records for reads SHALL be controlled by `recordActivity`.

#### Scenario: Pure inspection does not record activity

- **WHEN** a caller reads a terminal snapshot with activity recording disabled
- **THEN** no `terminal_read` activity event is appended
- **THEN** the terminal's activity history remains unchanged

#### Scenario: Explicit observation records activity

- **WHEN** a caller reads a terminal with activity recording enabled
- **THEN** a `terminal_read` activity event is appended with the observed representation metadata
- **THEN** terminal activity history can show the read without requiring consumers to replay full terminal output
