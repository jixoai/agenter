## MODIFIED Requirements

### Requirement: Cli-shell SHALL remain preserved as shell-old legacy code

Cli-shell SHALL move out of the official launcher path and remain preserved under `apps/shell-old`. Shell SHALL NOT modify shell-old for compatibility hooks. If shell needs behavior that exists in shell-old, it SHALL keep that behavior copied inside `apps/shell` and evolve it there.

#### Scenario: Shell-old does not stay on the official command path

- **WHEN** shell work is inspected
- **THEN** `apps/shell-old` has no new shell-only hooks
- **AND** shell does not import cli-shell runtime files
- **AND** stable `agenter shell` routes to the new shell package instead of shell-old
