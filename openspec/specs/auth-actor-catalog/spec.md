# auth-actor-catalog Specification

## Purpose
Define the auth-backed actor directory that collaboration surfaces use to resolve durable people, labels, and icons without conflating identity truth with room or terminal grants.

## Requirements

### Requirement: Auth actor catalog SHALL expose stable public actor projections

The system SHALL expose a catalog of public actor projections keyed by stable actor identity, including public label, actor kind, and icon URL.

#### Scenario: Durable auth actors appear in the catalog
- **WHEN** the client queries the auth actor catalog
- **THEN** durable auth identities are returned with stable `actorId`, display label, and icon URL
- **THEN** the catalog does not require room membership or terminal grants in order to resolve that public identity metadata

#### Scenario: Session actors remain distinct from auth actors
- **WHEN** the catalog includes a session actor that happens to share the same visible name as a durable auth actor
- **THEN** the two entries remain distinct by actor identity and actor kind
- **THEN** collaboration surfaces do not merge them solely by label

### Requirement: Collaboration pickers SHALL consume actor projections instead of freeform durable humans

Human-facing room and terminal admin flows SHALL select durable people from the auth actor catalog instead of inventing durable human actors from arbitrary text fields.

#### Scenario: Room grant flow picks a durable auth actor
- **WHEN** an admin adds a durable human participant to a room
- **THEN** the room grant flow selects that participant from the auth actor catalog
- **THEN** the room keeps its grant and token local while reusing the auth actor id as identity

#### Scenario: Terminal grant flow picks a durable auth actor
- **WHEN** an admin adds a durable human participant to a terminal
- **THEN** the terminal grant flow selects that participant from the auth actor catalog
- **THEN** the terminal keeps its grant and token local while reusing the auth actor id as identity

### Requirement: Collaboration pickers SHALL project valid actors without stale session floods
Actor pickers SHALL project durable auth actors and valid session seats, but they SHALL avoid flooding the operator with archived or stale session residue.

#### Scenario: Archived session residue does not dominate room picker defaults
- **WHEN** the room create dialog opens
- **THEN** stale or archived session entries are not auto-expanded into participant rows
- **AND** the picker remains focused on intentional seat selection

### Requirement: Actor catalog SHALL provide icon projections suitable for collaboration surfaces

The actor catalog SHALL expose icon URLs or equivalent public media descriptors that collaboration surfaces can render directly.

#### Scenario: Newly created auth actor has deterministic icon
- **WHEN** a durable auth actor has no uploaded profile image
- **THEN** the actor catalog still returns an icon projection backed by deterministic profile-service artwork
- **THEN** room and terminal user lists render that actor with a stable avatar instead of a missing placeholder
