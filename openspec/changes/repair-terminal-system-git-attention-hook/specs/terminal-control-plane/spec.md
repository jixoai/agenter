## ADDED Requirements

### Requirement: Terminal control plane SHALL expose non-consuming read cursor inspection

The terminal control plane SHALL expose a read-side inspection primitive that returns the current actor-scoped terminal read cursor hash without consuming terminal output, appending terminal activity, or mutating terminal lifecycle. This inspection is a projection over TerminalSystem read cursor truth and exists so runtime adapters can compare terminal git `HEAD` against the reader actor's last consumed hash before deciding whether to read.

#### Scenario: Actor cursor hash can be inspected without consuming output

- **GIVEN** terminal `main` has a git-log backed read cursor for actor `session:alpha`
- **WHEN** the runtime adapter inspects the cursor hash for `session:alpha`
- **THEN** the control plane returns that actor's cursor hash
- **AND** the cursor remains unchanged
- **AND** no `terminal_read` activity event is appended

#### Scenario: Missing cursor is represented as unread from null

- **GIVEN** terminal `main` has git `HEAD = H1`
- **AND** actor `session:alpha` has no terminal read cursor row
- **WHEN** the runtime adapter inspects the cursor hash for `session:alpha`
- **THEN** the control plane returns `null`
- **AND** the runtime adapter can treat non-null `HEAD` versus null cursor as unread terminal history

### Requirement: Terminal control plane SHALL preserve raw transport separation from automation activity

Live PTY transport input SHALL remain a raw interaction channel and MUST NOT be modeled as automation `terminal_write` activity. Terminal output created by raw transport SHALL be observable through terminal snapshot/git commit truth and read cursor comparison.

#### Scenario: Raw input changes terminal output without terminal_write activity

- **GIVEN** a live transport sends `inputBytes` into a terminal PTY
- **WHEN** terminal output changes and the terminal later enters `IDLE`
- **THEN** the terminal git `HEAD` and read cursor state expose whether there is unread output
- **AND** the activity log does not need a `terminal_write` record for the idle unread bridge to work

## MODIFIED Requirements

## REMOVED Requirements

## RENAMED Requirements
