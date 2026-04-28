## ADDED Requirements

### Requirement: Runtime terminal skills SHALL teach await as the bounded observation primitive

Built-in terminal guidance SHALL teach `terminal await` as the default active observation primitive when the AI needs to wait for terminal output, idle state, or deterministic text evidence. The guidance SHALL keep `terminal read` framed as immediate inspection and SHALL discourage reconstructing bounded observation through `sleep && terminal read | grep`.

#### Scenario: Terminal skill replaces sleep-read-grep guidance

- **WHEN** the runtime renders the built-in terminal skill
- **THEN** the guidance instructs the AI to use `terminal await` for bounded wait-for-evidence flows
- **AND** it does not teach `sleep && terminal read | grep` as the normal strategy for waiting on terminal state

#### Scenario: Terminal skill preserves immediate read guidance

- **WHEN** the runtime renders the built-in terminal skill
- **THEN** the guidance continues to describe `terminal read` as the immediate terminal inspection command
- **AND** it distinguishes immediate inspection from long-running await observation

#### Scenario: Terminal skill teaches snapshot lines as evidence

- **WHEN** the runtime renders guidance for `terminal await`
- **THEN** the guidance explains that await returns clean bounded snapshot lines and match context
- **AND** it explains that those lines are terminal canvas evidence rather than raw ANSI bytes

#### Scenario: Terminal skill teaches signal-safe bounded waits

- **WHEN** the runtime renders guidance for long-running terminal observation
- **THEN** it tells the AI to prefer the command-level timeout in `terminal await`
- **AND** it explains that shell-level timeout may still cancel the command and must not be relied on for post-mortem evidence
