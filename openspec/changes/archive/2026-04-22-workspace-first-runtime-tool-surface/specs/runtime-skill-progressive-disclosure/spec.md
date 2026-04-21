# runtime-skill-progressive-disclosure Specification

## MODIFIED Requirements

### Requirement: Runtime progressive disclosure SHALL reflect the split between root control and workspace execution
Runtime built-in skill guidance and sibling shell references SHALL distinguish between root-shell system control and project-workspace execution instead of implying one universal shell.

#### Scenario: Runtime skill guidance teaches the right shell for the job
- **WHEN** the runtime renders the built-in runtime skill surface
- **THEN** it teaches `workspace_list` to discover mounted project workspaces
- **AND** it teaches `root_bash` for runtime-local CLI/system control
- **AND** it teaches `workspace_bash` for workspace-local file and command work

#### Scenario: Objective verification guidance references root_bash
- **WHEN** runtime guidance explains outbound verification of current or external facts
- **THEN** it states that `root_bash` can perform those one-shot verification checks
- **AND** it does not reference `root_workspace_bash`
