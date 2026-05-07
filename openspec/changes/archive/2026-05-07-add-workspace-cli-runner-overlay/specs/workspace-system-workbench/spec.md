## MODIFIED Requirements

### Requirement: Workspace CLI mode SHALL render the grouped command catalog as a first-class workspace surface

`CLI` mode SHALL present the current workspace/avatar command catalog using grouped sections, route-local search, and the same shared workbench content law as other workspace modes.

`CLI` mode SHALL also expose one dedicated shell-dialog handoff so the operator can execute the selected command from the helpcenter without leaving the current workspace tab.

#### Scenario: CLI mode opens a shell dialog from the selected command

- **WHEN** the operator chooses `Run in shell` from one selected CLI row
- **THEN** Workspace opens one shell dialog inside the same workspace tab
- **AND** the shell dialog shows which shell surface will own the execution

#### Scenario: Shell dialog auto-runs the selected command on open

- **WHEN** the shell dialog opens for one selected CLI row
- **THEN** the dialog is seeded from that row's `suggestedCommand`
- **AND** the terminal projection immediately runs that command once without requiring a second click

#### Scenario: Shell dialog accepts later typed commands without rebuilding shell truth

- **WHEN** the operator types another command after the first run
- **THEN** the dialog reuses the same backend shell surface
- **AND** the browser still does not create a second local shell implementation
