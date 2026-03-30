## ADDED Requirements

### Requirement: Attention detail SHALL expose navigable room and terminal sources
Attention detail SHALL expose a source-navigation affordance whenever the underlying attention item resolves to a room or terminal source that the current user can browse.

#### Scenario: Room source jumps to Chats
- **WHEN** the selected attention item resolves to a room source
- **THEN** the detail surface exposes a navigation action that opens `Chats`
- **THEN** the corresponding room is selected or highlighted after navigation

#### Scenario: Terminal source jumps to Terminals
- **WHEN** the selected attention item resolves to a terminal source
- **THEN** the detail surface exposes a navigation action that opens `Terminals`
- **THEN** the corresponding terminal is selected or highlighted after navigation

### Requirement: Attention source navigation SHALL degrade explicitly when the source is unavailable
When an attention item carries a source ref that cannot currently be resolved or accessed, the UI SHALL keep an explicit unavailable state instead of silently dropping the navigation affordance.

#### Scenario: Unavailable source remains visible but disabled
- **WHEN** the selected attention item references a room or terminal that no longer exists or is not currently accessible
- **THEN** the detail surface shows the source navigation affordance in a disabled or unavailable state
- **THEN** the user receives a visible explanation that the source cannot be opened right now
