## ADDED Requirements

### Requirement: Runtime recovery SHALL compensate dead terminals through terminal-owned killed flow
Runtime recovery SHALL treat stale previously-running terminals as dead history instances and SHALL invoke terminal-owned compensation instead of reconstructing live state locally.

#### Scenario: Restarted runtime does not republish stale dead terminal as live
- **WHEN** runtime recovery encounters a terminal that daemon compensation moved through the killed flow
- **THEN** runtime terminal publications do not reattach or republish that terminal as part of the live focused or attached set
- **AND** callers must use explicit history surfaces to inspect it

## MODIFIED Requirements

### Requirement: Runtime terminal surface invalidation SHALL refresh one resource family at a time
Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, history, grants, approvals, and activity without rebuilding terminal truth in route-local code. Live render-only facts such as terminal `snapshot/status` ticks SHALL NOT be escalated into catalog invalidation, and killed terminals SHALL leave live terminal publications when the killed flow completes.

#### Scenario: Terminal activity invalidates only activity consumers
- **WHEN** terminal activity changes for one terminal
- **THEN** runtime publications identify that terminal in the activity invalidation set
- **THEN** client consumers can refresh terminal activity without recomputing unrelated surface resources

#### Scenario: Grant change invalidates seat projection consumers
- **WHEN** a terminal grant is issued or revoked
- **THEN** runtime publications identify that terminal in the grant invalidation set
- **THEN** client consumers can refresh call-as and seat projection data from one authoritative path

#### Scenario: Snapshot and status ticks stay out of catalog invalidation
- **WHEN** a running terminal emits live `snapshot` or `status` updates for renderer hydration
- **THEN** runtime publications do not mark `catalogChanged`
- **AND** browser terminal consumers do not refetch `terminal.globalList` for those render-only ticks

#### Scenario: Lifecycle change invalidates live catalog-facing terminal truth without using snapshot ticks
- **WHEN** a terminal is explicitly bootstrapped, killed, archived, or deleted
- **THEN** runtime publications identify the affected live or history projection mutation explicitly
- **AND** clients do not need to infer lifecycle from `snapshot/status` render ticks

#### Scenario: Observed identity updates stay distinct from launch truth
- **WHEN** the running terminal emits a new title or current path observation
- **THEN** runtime publications can refresh observed identity without mutating launch config fields
- **AND** clients preserve both truths simultaneously

#### Scenario: Real catalog mutation still invalidates catalog consumers
- **WHEN** terminal identity, presence, focus, or other catalog-facing live truth changes
- **THEN** runtime publications still identify the catalog invalidation explicitly
- **AND** catalog consumers can refresh from one authoritative signal

#### Scenario: Killed terminal leaves live publication sets
- **WHEN** the killed flow completes for a terminal that had been attached to the current runtime
- **THEN** runtime publications remove that terminal from live attached and focused terminal sets
- **AND** runtime status caches do not keep presenting it as a normal live terminal

### Requirement: Runtime terminal truth SHALL derive render, durable change log, and observation from one backend source
Whenever runtime publishes terminal state, renderable terminal state, durable terminal change-log truth, and LoopBus terminal observation ingress SHALL all originate from the same backend terminal truth rather than from client-local reconstructions. Dead-instance history projections SHALL remain backend-owned evidence and SHALL NOT be reconstructed from runtime caches.

#### Scenario: One backend change source drives renderer, commit, and observation truth
- **GIVEN** one backend terminal emits new renderable state
- **WHEN** runtime projects that change
- **THEN** renderer hydration, durable terminal change-log publication, and observation ingress refer to the same backend terminal change source
- **AND** clients do not synthesize a second authoritative transcript to bridge those paths

#### Scenario: Projection caches do not become durable terminal truth
- **WHEN** a client or host keeps local render caches
- **THEN** runtime does not promote those caches into authoritative durable terminal history or observation facts
- **AND** the runtime contract keeps backend terminal state as the only source of truth

#### Scenario: Dead terminal history stays backend-owned
- **WHEN** a terminal has left the live projection through the killed flow
- **THEN** runtime may expose history metadata or invalidation for that instance
- **AND** it does not reconstruct the dead terminal as a live attachment from runtime-local caches
