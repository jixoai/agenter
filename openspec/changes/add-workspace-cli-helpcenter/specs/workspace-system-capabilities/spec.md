## ADDED Requirements

### Requirement: WorkspaceSystem SHALL expose a structured command discovery surface for root and public workspace shells
WorkspaceSystem SHALL expose a structured command discovery surface for both the fixed root-workspace shell and mounted public-workspace shells. That discovery surface SHALL not rely on bare `help`, because `just-bash` builtin help does not enumerate custom command bindings.

#### Scenario: Root-workspace shell exposes helpcenter alongside runtime CLI
- **WHEN** the operator or AI uses the fixed root-workspace shell
- **THEN** the shell exposes a `helpcenter` command for structured command discovery
- **AND** the root-workspace catalog includes root-available runtime CLI commands plus `just-bash` builtins

#### Scenario: Public-workspace shell exposes helpcenter without root-exclusive runtime CLI
- **WHEN** the operator or AI uses a mounted public-workspace shell
- **THEN** the shell exposes a `helpcenter` command for structured command discovery
- **AND** the public-workspace catalog includes `just-bash` builtins and workspace tool commands
- **AND** it does not claim root-exclusive runtime CLI commands are callable from that surface
