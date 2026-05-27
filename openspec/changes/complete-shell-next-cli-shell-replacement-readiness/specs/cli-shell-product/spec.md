## MODIFIED Requirements

### Requirement: Cli-shell SHALL remain untouched while shell-next incubates replacement atoms

Cli-shell SHALL remain the legacy `agenter shell` product until explicit shell-next acceptance. Shell-next SHALL NOT modify cli-shell for compatibility hooks. If shell-next needs behavior that exists in cli-shell, it SHALL copy the code into `extensions/shell-next` and evolve it there.

#### Scenario: Shell-next does not add cli-shell compatibility hooks

- **WHEN** shell-next work is inspected
- **THEN** `extensions/cli-shell` has no new shell-next-only hooks
- **AND** shell-next does not import cli-shell runtime files
- **AND** stable `agenter shell` continues to route to the legacy cli-shell package until explicit acceptance
