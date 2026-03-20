## Purpose

Define the public chat projection contract for LoopBus-backed session cycles.
## Requirements
### Requirement: Session chat cycles are projected from LoopBus cycles
The system SHALL expose chat history as ordered cycles derived from `session_cycle` facts, and all public chat projection APIs SHALL use `cycle` terminology instead of `round`. The WebUI MAY project those cycles into a conversation-first stream, but cycle identity SHALL remain stable so Chat and Devtools can both navigate by cycle.

#### Scenario: Query completed cycles
- **WHEN** a client queries chat cycles for a session with completed LoopBus cycles
- **THEN** the response returns cycles ordered from oldest to newest, and each cycle includes its `cycleId`, `kind`, `status`, collected inputs, assistant outputs, `clientMessageIds`, and `modelCallId`

#### Scenario: UI can navigate conversation by cycle identity
- **WHEN** the WebUI renders a conversation-first view and a cycle-oriented Devtools timeline for the same session
- **THEN** both surfaces can reference the same stable cycle identifiers
- **THEN** chat-side cycle navigation can jump to the corresponding cycle-backed content

### Requirement: Live cycle updates use cycle terminology
The runtime SHALL surface the active chat projection as a cycle while a LoopBus cycle is still in progress, and realtime clients SHALL observe that projection through cycle-named events and fields.

#### Scenario: Show the active cycle in runtime snapshots
- **WHEN** a session runtime is collecting, streaming, or applying a cycle
- **THEN** the runtime snapshot exposes that projection as `activeCycle`

#### Scenario: Emit cycle update events
- **WHEN** the active chat projection changes during runtime execution
- **THEN** the server emits `runtime.cycle.updated` with payload `{ cycle }`

