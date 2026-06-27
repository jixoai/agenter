## MODIFIED Requirements

### Requirement: App extensions SHALL consume generic backend APIs without creating app-specific core terminal roles

App extensions MAY bind rooms, initialize assistants, and commit attention through generic APIs. App extensions SHALL NOT require core TerminalSystem to store app-specific terminal roles, app chrome, pane topology, or composed terminal metadata.

#### Scenario: cli-shell uses room binding without terminal role metadata

- **WHEN** cli-shell ensures its app room
- **THEN** it uses generic app-owned room metadata
- **AND** it does not require a matching TerminalSystem `terminal-2` resource

#### Scenario: App extension runtime remains reusable after cli-shell migration

- **WHEN** reviewers inspect app-extension runtime after cli-shell moves to `apps/cli-shell`
- **THEN** the runtime still exposes generic room/avatar/attention binding laws
- **AND** it does not import cli-shell implementation code
- **AND** it does not branch on tmux, `terminal-2`, or cli-shell pane layout
