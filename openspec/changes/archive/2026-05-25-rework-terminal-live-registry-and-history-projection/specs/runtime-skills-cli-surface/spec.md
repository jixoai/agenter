## MODIFIED Requirements

### Requirement: Built-in terminal skill SHALL teach explicit lifecycle control
The built-in `agenter-terminal` skill and its lifecycle references SHALL teach runtime terminal lifecycle through `create or recover`, `bootstrap`, `read`, `write/input`, `stop`, `history`, `archive`, and `delete`. The guidance SHALL describe `stop` as the live-to-history transition and SHALL reserve `delete` for final destructive removal.

#### Scenario: Terminal skill teaches bootstrap before not-started terminal work
- **WHEN** the runtime renders the built-in terminal skill for a not-started terminal workflow
- **THEN** the guidance instructs the caller to inspect `terminal list` and use `terminal bootstrap` before expecting read/write to work
- **AND** it does not imply that opening or reading the terminal will auto-start the PTY

#### Scenario: Terminal skill distinguishes stop, history, and delete semantics
- **WHEN** the runtime renders lifecycle guidance for terminal shutdown and cleanup
- **THEN** the skill explains that `terminal stop` halts the PTY and moves the instance into history
- **AND** it explains that `terminal history` is the place to inspect dead-instance evidence
- **AND** it explains that `terminal delete` is the final destructive removal path

### Requirement: Built-in terminal skills SHALL teach transition-aware lifecycle law
Built-in runtime terminal skill guidance and lifecycle references SHALL teach the current create/bootstrap/stop/history law, including the fact that dead terminals leave the default live list.

#### Scenario: Terminal skill teaches create auto-bootstrap
- **WHEN** the runtime renders the built-in `agenter-terminal` skill
- **THEN** the guidance explains that `terminal create` auto-bootstraps new terminals by default
- **AND** the caller is not told to run a redundant second bootstrap for a freshly created terminal unless the create result still shows a transition or not-started state

#### Scenario: Terminal skill teaches dead terminals are history-only
- **WHEN** the runtime renders lifecycle recovery guidance for an existing terminal that has already been killed
- **THEN** the guidance tells the AI to use `terminal history` to inspect it
- **AND** it does not teach the AI that the dead terminal remains part of the normal `terminal list`

#### Scenario: Terminal skill teaches transition wait instead of mutation stacking
- **WHEN** the runtime renders lifecycle guidance for a terminal whose `lifecycleTransition` is `bootstrapping` or `killing`
- **THEN** the guidance tells the AI to wait and reread lifecycle state
- **AND** it does not teach the AI to stack another bootstrap or stop command on top of the in-flight mutation
