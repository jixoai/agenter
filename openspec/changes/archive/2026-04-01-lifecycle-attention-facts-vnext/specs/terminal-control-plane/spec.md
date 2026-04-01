## MODIFIED Requirements

### Requirement: Terminal focus SHALL be managed as a declarative focus set

Terminal focus transitions SHALL be recorded as passive lifecycle facts for both newly focused and newly unfocused terminals.

#### Scenario: Clearing focus records unfocus facts
- **WHEN** a caller invokes `terminal_focus` with `op = clear`
- **THEN** the focused-terminal set becomes empty
- **AND** each terminal that lost focus receives a passive `terminal_unfocus` lifecycle commit

### Requirement: Terminal control plane SHALL own terminal lifecycle operations

Terminal lifecycle and control-plane configuration changes SHALL publish attention facts with explicit active/passive semantics.

#### Scenario: Create and delete stay active
- **WHEN** a caller creates or kills a terminal instance
- **THEN** runtime appends `terminal_create` or `terminal_delete` lifecycle commits
- **AND** those commits remain active attention debt by default

#### Scenario: Config changes use a dedicated control-plane context
- **WHEN** a caller updates terminal control-plane config
- **THEN** runtime appends a `terminal_config_update` lifecycle commit into `ctx-terminal-control-plane`
- **AND** that commit remains active attention debt by default
