## ADDED Requirements

### Requirement: Terminal control plane SHALL expose cancellation-safe await observation

The terminal control plane SHALL expose a `terminal_await` operation that waits for a bounded terminal physical-state condition and returns structured observation evidence. The operation MUST use TerminalSystem-owned facts such as headless snapshots, status, running state, and commit cursors; it MUST NOT hardcode business-specific or model-specific terminal semantics.

#### Scenario: Await changed output resolves from terminal commit truth

- **WHEN** an authorized caller awaits a running terminal with `until = changed` and a `fromHash` or equivalent cursor
- **THEN** the control plane resolves when terminal snapshot truth advances beyond that cursor
- **AND** the result identifies the observed cursor movement without requiring the caller to run `sleep`

#### Scenario: Await releases resources when cancelled

- **WHEN** a caller, transport, shell process, or runtime abort signal cancels an in-flight terminal await
- **THEN** every waiter, status listener, snapshot listener, timer, and fallback poll handle created for that await is released
- **AND** later terminal changes do not resolve or retain the cancelled await

#### Scenario: Await stopped terminal resolves as stopped evidence

- **WHEN** a terminal stops while a caller is awaiting a condition on that terminal
- **THEN** the await resolves or rejects through a terminal-stopped outcome that preserves the last available terminal evidence
- **AND** it does not leave a pending waiter attached to the stopped terminal

### Requirement: Terminal await SHALL evaluate deterministic conditions over clean stable snapshots

Terminal await conditions SHALL be evaluated against stable plain-text snapshot lines derived from the existing headless terminal state. The operation MUST NOT match against raw PTY bytes or ANSI transition chunks.

#### Scenario: Match evaluates stable snapshot lines

- **WHEN** a caller awaits with a `match.pattern`
- **THEN** the control plane waits for the configured stabilization window before evaluating the pattern
- **AND** matching is performed against clean snapshot text generated from the terminal canvas
- **AND** the result includes evidence for the matched line or text span

#### Scenario: Absent evaluates the stable snapshot state

- **WHEN** a caller awaits with `until = absent` and a `match.pattern`
- **THEN** the control plane resolves only after the stable snapshot does not contain that pattern
- **AND** the result states that the condition was evaluated against the final stable snapshot rather than an append-only log stream

#### Scenario: Timeout returns last observed evidence

- **WHEN** a terminal await reaches its command-level `timeoutMs`
- **THEN** the control plane returns a timeout outcome
- **AND** the result includes the last snapshot evidence available before timeout
- **AND** the control plane cleans up all internal wait resources for that await
