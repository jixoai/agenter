## MODIFIED Requirements

### Requirement: Collaboration pickers SHALL project valid actors without stale session floods

Actor pickers SHALL project durable auth actors and valid session seats, but they SHALL avoid flooding the operator with archived or stale session residue.

#### Scenario: Archived session residue does not dominate room picker defaults
- **WHEN** the room create dialog opens
- **THEN** stale or archived session entries are not auto-expanded into participant rows
- **AND** the picker remains focused on intentional seat selection
