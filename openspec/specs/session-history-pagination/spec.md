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

### Requirement: Technical history resources SHALL share one reverse-time list envelope
Long-history technical resources SHALL expose one shared reverse-time response envelope that is suitable for direct prepend rendering and virtualized list controllers.

#### Scenario: Different technical timelines share the same page envelope
- **WHEN** a client queries paged history for chat, cycles, terminal activity, model calls, or loop/attention timelines
- **THEN** each route returns the same structural page envelope with ordered `items`, `nextBefore`, and `hasMoreBefore`
- **THEN** the client can reuse one generic long-list controller instead of resource-specific transforms

#### Scenario: Older pages prepend without reordering the visible window
- **WHEN** the client requests an older page for a technical history resource
- **THEN** the returned rows remain in display order for direct prepend merge
- **THEN** the currently visible newest window remains readable while older rows are inserted

