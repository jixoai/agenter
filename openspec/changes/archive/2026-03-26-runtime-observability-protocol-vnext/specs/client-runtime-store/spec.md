## MODIFIED Requirements

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource
The client runtime store SHALL maintain explicit reverse-time page state for each long-history session resource and SHALL use observability-first resource ids instead of legacy `loopbus-trace` naming.

#### Scenario: Hydration keeps a recent window
- **WHEN** the client hydrates a session with existing chat, cycles, observability trace, or model history
- **THEN** it loads only the newest configured window for each resource
- **THEN** older history remains available through the resource paging state

#### Scenario: Loading older observability pages preserves order and identity
- **WHEN** the client prepends an older observability trace page for a session resource
- **THEN** the merged list remains ordered from oldest to newest
- **THEN** already-known items are not duplicated

## ADDED Requirements

### Requirement: Client runtime store SHALL expose scheduler and observability slices without legacy LoopBus naming
The client runtime store SHALL own scheduler state logs, runtime traces, and related access maps/cursors through scheduler/observability-first field names and SHALL not require first-party consumers to depend on `loopbus*` state keys.

#### Scenario: Route consumers read renamed runtime slices
- **WHEN** WebUI route surfaces subscribe to scheduler logs or runtime traces
- **THEN** they read scheduler/observability-named state slices from the runtime store
- **THEN** no first-party selector depends on `loopbusStateLogsBySession` or `loopbusTracesBySession`

#### Scenario: Orphan model-debug helpers are removed
- **WHEN** the client runtime store exposes transport inspection primitives
- **THEN** those primitives are based on draft resolution, model-call records, and API-call records
- **THEN** first-party client code does not depend on `inspectModelDebug` or related helpers
