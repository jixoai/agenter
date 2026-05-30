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

### Requirement: Terminal control plane SHALL expose a cancellable terminal commit waiter

The terminal control plane SHALL expose a terminal commit wait primitive that resolves when terminal output truth advances beyond a supplied head hash and can be rejected by its caller when the caller's lifecycle window ends. This primitive remains TerminalSystem-owned and MUST NOT commit attention or know about LoopBus; it only reports that terminal truth has advanced.

#### Scenario: Idle bridge waits from the current terminal head

- **GIVEN** the runtime adapter observes terminal `main` entering `IDLE`
- **AND** terminal `HEAD = H1`
- **WHEN** the adapter asks TerminalSystem to wait for commits after `H1`
- **THEN** the returned wait handle resolves only after terminal truth advances beyond `H1`
- **AND** the adapter may reject the handle if terminal `main` leaves `IDLE`

### Requirement: Terminal control plane SHALL preserve raw transport separation from automation activity

Live PTY transport input SHALL remain a raw interaction channel and MUST NOT be modeled as automation `terminal_write` activity. Terminal output created by raw transport SHALL be observable through terminal snapshot/git commit truth and read cursor comparison.

#### Scenario: Raw input changes terminal output without terminal_write activity

- **GIVEN** a live transport sends `inputBytes` into a terminal PTY
- **WHEN** terminal output changes and the terminal later enters `IDLE`
- **THEN** the terminal git `HEAD` and read cursor state expose whether there is unread output
- **AND** the activity log does not need a `terminal_write` record for the idle unread bridge to work

#### Scenario: Raw input advances terminal truth and actor read cursor through the integrated TerminalSystem chain

- **GIVEN** a git-log backed terminal is running and focused for actor `session:alpha`
- **AND** the actor's read cursor is at terminal head `H1`
- **AND** a control-plane commit waiter is waiting from the current terminal snapshot head
- **WHEN** a live transport sends `inputBytes` and the PTY output changes while the terminal is already `IDLE`
- **THEN** the control-plane commit waiter resolves with a newer terminal truth boundary
- **AND** sealing the idle terminal exposes a non-null git `HEAD = H2`
- **AND** consuming `readAuthorized(... remark: true)` reads from `H1` to `H2`
- **AND** the actor read cursor becomes `H2`
- **AND** no automation `terminal_write` activity is appended for the raw input

### Requirement: Product-bound terminals SHALL request git-backed history

Product/global terminal creation paths that are intended to participate in runtime attention SHALL create git-log backed terminals by default. This is the durable terminal truth required by the idle unread bridge; product bindings MUST NOT rely on hand-built test profiles to enable terminal history.

#### Scenario: Product terminal binding requests git-backed history

- **GIVEN** shell-next creates a product global terminal binding
- **WHEN** it asks TerminalSystem to create that terminal
- **THEN** the terminal creation request includes `gitLog: "normal"`

#### Scenario: Daemon global terminals default to git-backed history

- **GIVEN** a product or admin path creates a global terminal without an explicit `gitLog` profile
- **WHEN** the daemon AppKernel provisions the shared TerminalControlPlane
- **THEN** the created terminal still has git-backed history available for read cursor comparison

## MODIFIED Requirements

## REMOVED Requirements

## RENAMED Requirements
