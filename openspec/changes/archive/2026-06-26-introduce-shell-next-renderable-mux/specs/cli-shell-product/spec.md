## ADDED Requirements

### Requirement: Stable cli-shell SHALL remain the shell command during shell-next incubation

The existing cli-shell app SHALL remain the implementation behind the stable `shell` command while shell-next is incubated. Shell-next SHALL use `shell2` as a separate local command until a later acceptance and rename change explicitly promotes it.

#### Scenario: Shell-next does not replace shell during incubation
- **WHEN** shell-next code exists under `apps/shell-next`
- **THEN** `bun agenter shell` still starts the existing cli-shell app
- **AND** `bun agenter shell2` starts shell-next
- **AND** no current cli-shell package name, bin name, or stable command is renamed by this change

#### Scenario: Legacy rename waits for later acceptance
- **WHEN** shell-next reaches an implementation milestone
- **THEN** the existing `apps/cli-shell` directory remains in place
- **AND** it is not renamed to shell-legacy until a later change explicitly performs the migration
- **AND** the later migration must preserve a rollback path to the current cli-shell implementation
