## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL expose a structured command discovery surface for root and public workspace shells

WorkspaceSystem SHALL expose a structured command discovery surface for both the fixed root-workspace shell and mounted public-workspace shells. That discovery surface SHALL not rely on bare `help`, because `just-bash` builtin help does not enumerate custom command bindings.

The browser workspace execution surface SHALL also be able to choose between `root-workspace` and `public-workspace` explicitly instead of assuming all browser executions belong to the same shell profile.

#### Scenario: Browser routes one root-shell command through active runtime truth

- **WHEN** the browser executes a workspace CLI row with `preferredExecutionSurface = "root-workspace"`
- **THEN** the platform routes that call through the active runtime's durable root shell world
- **AND** the browser does not reconstruct a second local shell implementation

#### Scenario: Browser public-workspace exec keeps collaboration shell semantics

- **WHEN** the browser executes a workspace CLI row with `preferredExecutionSurface = "public-workspace"`
- **THEN** the platform routes that call through the public-workspace one-shot shell
- **AND** the shell keeps public-workspace grant and env semantics

#### Scenario: Root-shell browser exec does not auto-start stopped runtime authority

- **WHEN** the browser requests `root-workspace` execution for a runtime that is not currently active
- **THEN** the request fails with an explicit runtime-not-active error
- **AND** the platform does not auto-start the runtime merely to satisfy that browser exec call
