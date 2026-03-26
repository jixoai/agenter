## MODIFIED Requirements

### Requirement: Session history APIs SHALL use explicit reverse-time pagination
Long-lived session history resources SHALL expose one shared reverse-time page contract using an explicit `{ beforeTimeMs, beforeId }` cursor instead of resource-specific id-only pagination, and the resource set SHALL use observability-first ids.

#### Scenario: Request the newest observability window
- **WHEN** a client queries the runtime observability trace resource without a `before` cursor
- **THEN** the server returns the newest page for that resource
- **THEN** the response includes `nextBefore` only when older history still exists

#### Scenario: Request older observability history
- **WHEN** a client queries the runtime observability trace resource with a `before` cursor
- **THEN** the server returns only rows older than that `(beforeTimeMs, beforeId)` boundary
- **THEN** the returned rows remain ordered from oldest to newest for direct prepend rendering
