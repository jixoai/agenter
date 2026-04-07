## MODIFIED Requirements

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management surface, send-as options, and read-progress details SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses.

#### Scenario: Viewer selector lists canonical actors
- **WHEN** the operator opens the room viewer selector
- **THEN** each option is keyed by canonical actor identity
- **THEN** duplicate visible labels remain selectable as separate actors

#### Scenario: Session-backed viewer title prefers canonical session identity even after stop
- **WHEN** the selected room viewer resolves to a session-backed actor that still exists in active client session metadata
- **AND** that session exposes both a human `avatar` label and an opaque runtime `name`
- **THEN** the Room toolbar and viewer selector use the avatar label as the primary visible title
- **THEN** any raw session id remains secondary detail only when needed for disambiguation
