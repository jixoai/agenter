## MODIFIED Requirements

### Requirement: Built-in terminal skills SHALL teach transition-aware lifecycle law

Built-in runtime terminal skill guidance and lifecycle references SHALL teach the current create/bootstrap/stop law, including transient transition handling for collaborative terminals.

#### Scenario: Terminal skill teaches create auto-bootstrap

- **WHEN** the runtime renders the built-in `agenter-terminal` skill
- **THEN** the guidance explains that `terminal create` auto-bootstraps new terminals by default
- **AND** the caller is not told to run a redundant second bootstrap for a freshly created terminal unless the create result still shows a transition or stopped state

#### Scenario: Terminal skill teaches stopped-terminal explicit bootstrap

- **WHEN** the runtime renders lifecycle recovery guidance for an existing terminal whose `processPhase` is `not_started` or `stopped`
- **THEN** the guidance tells the AI to run `terminal bootstrap`
- **AND** it distinguishes that path from fresh create

#### Scenario: Terminal skill teaches transition wait instead of mutation stacking

- **WHEN** the runtime renders lifecycle guidance for a terminal whose `lifecycleTransition` is `bootstrapping` or `killing`
- **THEN** the guidance tells the AI to wait and reread lifecycle state
- **AND** it does not teach the AI to stack another bootstrap or stop command on top of the in-flight mutation

### Requirement: Built-in terminal skills SHALL expose config inspection and mutation guidance

Built-in terminal skill guidance SHALL teach `terminal get-config` and `terminal set-config` as the canonical shell-facing surface for durable launch truth.

#### Scenario: Terminal skill teaches get-config and set-config

- **WHEN** the runtime renders the built-in `agenter-terminal` skill and references
- **THEN** the guidance tells the AI to use `terminal get-config` when it needs the durable launch command, default cwd, title, geometry, or metadata
- **AND** it tells the AI to use `terminal set-config` when it needs to update those durable terminal defaults without recreating the terminal id
