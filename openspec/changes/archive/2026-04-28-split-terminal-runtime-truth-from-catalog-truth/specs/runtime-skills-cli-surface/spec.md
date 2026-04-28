## MODIFIED Requirements

### Requirement: Built-in terminal skill SHALL teach explicit lifecycle control

The built-in `agenter-terminal` skill and its lifecycle references SHALL teach runtime terminal lifecycle through `create or recover`, `bootstrap`, `read`, `write/input`, and `stop` instead of keeping legacy `kill` wording as the primary lifecycle law.

#### Scenario: Terminal skill teaches bootstrap before stopped-terminal work

- **WHEN** the runtime renders the built-in terminal skill for a stopped or not-started terminal workflow
- **THEN** the guidance instructs the caller to inspect `terminal list` and use `terminal bootstrap` before expecting read/write to work
- **AND** it does not imply that opening or reading the terminal will auto-start the PTY

#### Scenario: Terminal skill distinguishes stop from delete semantics

- **WHEN** the runtime renders lifecycle guidance for terminal shutdown
- **THEN** the skill explains that `terminal stop` halts the PTY while preserving durable terminal identity
- **AND** it does not teach the old `kill means delete` mental model
