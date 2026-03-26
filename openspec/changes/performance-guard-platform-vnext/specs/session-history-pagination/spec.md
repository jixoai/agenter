## ADDED Requirements

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
