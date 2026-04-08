## ADDED Requirements

### Requirement: The system SHALL provide deterministic fallback icons for typed entity owners
The icon system SHALL support typed entity owners in addition to sessions and profiles. Room icons SHALL be the first additional typed owner, and the same typed owner model SHALL remain available for future entities such as terminals or tasks. When an uploaded icon is absent, each typed owner MUST resolve deterministic fallback artwork from a stable owner-specific seed through the same backend-rendered authority.

#### Scenario: Room icon falls back deterministically
- **WHEN** the client requests a room icon for a room that has no uploaded icon asset
- **THEN** the backend returns deterministic fallback artwork derived from that room's stable icon seed
- **THEN** repeated requests for the same room return visually stable fallback output

#### Scenario: Future typed owners reuse the same authority model
- **WHEN** the platform introduces another typed owner such as a terminal or task
- **THEN** that owner can resolve icon fallback through the same typed icon authority contract
- **THEN** the system does not require a second ad hoc icon service for that entity family

### Requirement: The system SHALL allow uploaded icons for typed entity owners
The icon system SHALL allow room and future typed entity owners to persist uploaded icons through the canonical icon authority, and those uploaded assets SHALL override deterministic fallback output from the same semantic owner URL.

#### Scenario: Uploaded room icon overrides fallback
- **WHEN** an authorized caller uploads a new icon for a room
- **THEN** the backend persists that icon for the room owner
- **THEN** subsequent room icon reads return the uploaded icon instead of deterministic fallback artwork
