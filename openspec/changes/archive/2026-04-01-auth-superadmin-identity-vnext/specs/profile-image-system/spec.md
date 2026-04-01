## MODIFIED Requirements

### Requirement: The system SHALL provide deterministic fallback icons for sessions and avatars

The system SHALL expose stable media endpoints for sessions and durable profiles, including auth actors used by collaboration surfaces. When an uploaded icon asset and any eligible external fallback source are unavailable, those endpoints MUST return deterministic fallback artwork derived from stable owner inputs so the same session or profile identity always renders the same icon.

#### Scenario: Collaboration roster reads a durable actor icon
- **WHEN** a room or terminal user list renders a durable auth actor without an uploaded icon
- **THEN** the backend returns deterministic fallback artwork for that actor through the stable profile media endpoint
- **THEN** the roster does not degrade to a missing or random local placeholder outside profile-service control

#### Scenario: Same actor icon stays stable across room and terminal surfaces
- **WHEN** the same auth actor appears in a room user list and a terminal user list
- **THEN** both surfaces resolve the same canonical icon projection
- **THEN** the actor does not appear with divergent fallback artwork between those two collaboration surfaces
