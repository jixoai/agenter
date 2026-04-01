## MODIFIED Requirements

### Requirement: Terminal resources SHALL enforce actor-scoped grants

The terminal collaboration control plane SHALL enforce grants bound to auth actors or session actors with roles `admin`, `writer`, `requester`, and `readonly`. Focus state SHALL also remain actor-scoped and SHALL be mutated only through that actor's terminal authority or a valid superadmin recovery path.

#### Scenario: Focus mutation uses actor-scoped authority
- **WHEN** an actor focuses or unfocuses a terminal
- **THEN** the control plane validates that mutation against that actor's grant or superadmin recovery authority
- **THEN** the resulting focus state is stored only for that actor seat

#### Scenario: One actor cannot clear another actor's focus without admin authority
- **WHEN** a non-admin actor attempts to clear another actor seat's focus state
- **THEN** the control plane rejects that mutation
- **THEN** the other actor's focus truth remains unchanged

#### Scenario: Selected seat token survives superadmin operator context
- **WHEN** a superadmin operator uses a seat token to focus, read, or write a terminal on behalf of that seat
- **THEN** terminal-system validates the action against that seat token
- **THEN** the recorded actor and focus truth belong to the selected seat instead of the superadmin operator
