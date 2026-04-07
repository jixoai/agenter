## MODIFIED Requirements

### Requirement: Terminal tool actions SHALL require an explicit acting actor

Terminal read/write or other tool-call actions initiated from the UI SHALL let the operator choose which auth-backed actor performs the action.

#### Scenario: Tool call with actor selection
- **WHEN** the operator selects an actor and invokes a terminal tool action
- **THEN** the request is sent using that actor selection rather than an implicit global identity

#### Scenario: Session-backed terminal actor prefers canonical session identity even after stop
- **WHEN** a terminal seat or `call as` option resolves to a session-backed actor that still exists in active client session metadata
- **AND** that session exposes both a human `avatar` label and an opaque runtime `name`
- **THEN** the terminal Users pane and `call as` selector use the avatar label as the primary visible text
- **THEN** any raw runtime id remains secondary detail only when needed for disambiguation
