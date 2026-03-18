## Purpose

Define the public chat projection contract for LoopBus-backed session cycles.

## Requirements

### Requirement: Session chat cycles are projected from LoopBus cycles
The system SHALL expose chat history as ordered cycles derived from `session_cycle` facts, and all public chat projection APIs SHALL use `cycle` terminology instead of `round`.

#### Scenario: Query completed cycles
- **WHEN** a client queries chat cycles for a session with completed LoopBus cycles
- **THEN** the response returns cycles ordered from oldest to newest, and each cycle includes its `cycleId`, `kind`, `status`, collected inputs, assistant outputs, `clientMessageIds`, and `modelCallId`

#### Scenario: Page older cycles by cycle cursor
- **WHEN** the client requests more history before a known cycle id
- **THEN** the server returns only cycles older than that cycle, and the client merges them without duplicating existing pending or persisted cycles

### Requirement: Live cycle updates use cycle terminology
The runtime SHALL surface the active chat projection as a cycle while a LoopBus cycle is still in progress, and realtime clients SHALL observe that projection through cycle-named events and fields.

#### Scenario: Show the active cycle in runtime snapshots
- **WHEN** a session runtime is collecting, streaming, or applying a cycle
- **THEN** the runtime snapshot exposes that projection as `activeCycle`

#### Scenario: Emit cycle update events
- **WHEN** the active chat projection changes during runtime execution
- **THEN** the server emits `runtime.cycle.updated` with payload `{ cycle }`
