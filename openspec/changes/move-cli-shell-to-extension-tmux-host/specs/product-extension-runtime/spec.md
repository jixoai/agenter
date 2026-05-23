## MODIFIED Requirements

### Requirement: Product extensions SHALL consume generic backend APIs without creating product-specific core terminal roles

Product extensions MAY bind rooms, initialize assistants, and commit attention through generic APIs. Product extensions SHALL NOT require core TerminalSystem to store product-specific terminal roles, product chrome, pane topology, or composed terminal metadata.

#### Scenario: cli-shell uses room binding without terminal role metadata

- **WHEN** cli-shell ensures its product room
- **THEN** it uses generic product-owned room metadata
- **AND** it does not require a matching TerminalSystem `terminal-2` resource

#### Scenario: Product extension runtime remains reusable after cli-shell migration

- **WHEN** reviewers inspect product-extension runtime after cli-shell moves to `extensions/cli-shell`
- **THEN** the runtime still exposes generic room/avatar/attention binding laws
- **AND** it does not import cli-shell implementation code
- **AND** it does not branch on tmux, `terminal-2`, or cli-shell pane layout
