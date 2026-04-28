## MODIFIED Requirements

### Requirement: Runtime terminal surface invalidation SHALL refresh one resource family at a time

Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, grants, approvals, and activity without rebuilding terminal truth in route-local code. Live render-only facts such as terminal `snapshot/status` ticks SHALL NOT be escalated into `catalogChanged`.

#### Scenario: Snapshot and status ticks stay out of catalog invalidation

- **WHEN** a stopped terminal boots through transport and emits live `snapshot` or `status` updates for renderer hydration
- **THEN** runtime publications do not mark `catalogChanged`
- **AND** browser terminal consumers do not refetch `terminal.globalList` for those render-only ticks

#### Scenario: Real catalog mutation still invalidates catalog consumers

- **WHEN** terminal identity, presence, focus, or other catalog-facing truth changes
- **THEN** runtime publications still identify the catalog invalidation explicitly
- **AND** catalog consumers can refresh from one authoritative signal
