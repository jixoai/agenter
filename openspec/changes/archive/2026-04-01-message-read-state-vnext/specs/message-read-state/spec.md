# message-read-state Specification

## Purpose

Define actor-scoped room read cursors and read-progress projection for group chat collaboration surfaces.

## Requirements

### Requirement: Rooms SHALL track read-state per actor seat

Message-system SHALL track read-state per actor seat for each room, including the latest read message boundary and read timestamp when available.

#### Scenario: One actor reads later than another
- **WHEN** two room seats read the same room at different times
- **THEN** each seat keeps its own read boundary and read timestamp
- **THEN** the room can report that one seat has read farther than the other

#### Scenario: Unread seat remains visible
- **WHEN** one room seat has not read the latest visible message
- **THEN** the room projection still includes that seat in the unread portion of the read-state view
- **THEN** the UI can distinguish unread from missing-seat cases

### Requirement: Room projections SHALL expose aggregate read progress

Room-facing projections SHALL expose a compact aggregate view suitable for read-progress UI and a detailed per-seat view suitable for disclosure surfaces.

#### Scenario: Read ring shows partial progress
- **WHEN** some room seats have read the latest visible message and others have not
- **THEN** the projection exposes aggregate counts or progress that can render as a compact read ring
- **THEN** the detailed view still exposes the per-seat breakdown behind that compact summary
