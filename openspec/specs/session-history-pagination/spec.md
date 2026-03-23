## Purpose

Define the shared reverse-time pagination contract for long-lived session history resources.

## Requirements

### Requirement: Session history APIs SHALL use explicit reverse-time pagination
Long-lived session history resources SHALL expose one shared reverse-time page contract using an explicit `{ beforeTimeMs, beforeId }` cursor instead of resource-specific id-only pagination.

#### Scenario: Request the newest window
- **WHEN** a client queries a session history resource without a `before` cursor
- **THEN** the server returns the newest page for that resource
- **THEN** the response includes `nextBefore` only when older history still exists

#### Scenario: Request older history
- **WHEN** a client queries a session history resource with a `before` cursor
- **THEN** the server returns only rows older than that `(beforeTimeMs, beforeId)` boundary
- **THEN** the returned rows remain ordered from oldest to newest for direct prepend rendering
