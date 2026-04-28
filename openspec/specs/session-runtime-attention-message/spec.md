# session-runtime-attention-message Specification

## Purpose
TBD - created by archiving change session-runtime-attention-message-migration. Update Purpose after archive.
## Requirements

### Requirement: Session runtime SHALL route chat through attention and message adapters

Session runtime SHALL continue to ingest unread room work into attention, but room-visible assistant output MUST occur only when the model executes explicit message-system mutations. Attention commits alone SHALL remain internal, and visible room output SHALL still not count as completion until the related attention is settled separately. When one task spans an originating room and a secondary relay room, the originating room SHALL remain the owner of completion, and the factual answer MUST remain recoverable after a manual compact cycle.

#### Scenario: Unread room work enters attention without auto-replying
- **WHEN** the runtime selects unread room work for a new round
- **THEN** it converts that room work into attention state for the model
- **THEN** no visible assistant room message is created until the model later performs an explicit message mutation

#### Scenario: Explicit room mutation produces the visible reply
- **WHEN** the model calls `message send`, `message edit`, or `message recall` for a room-backed task
- **THEN** the runtime applies that authorized message-system mutation as the only source of visible room transcript change
- **THEN** the related attention remains unresolved until the model also records the corresponding settlement

#### Scenario: Attention commit alone does not become a room row
- **WHEN** the model commits attention progress, summary changes, or cleanup without calling a message-system mutation
- **THEN** the room transcript remains unchanged
- **THEN** the internal progress stays visible only through attention/runtime inspection surfaces

#### Scenario: Single-room reply stays unresolved until attention settles
- **WHEN** the assistant sends a user-visible reply into the current room for a chat-backed task
- **THEN** the runtime keeps the related attention active until the assistant records the corresponding settlement
- **THEN** the task is not considered complete while only the visible reply exists

#### Scenario: Main room request relays through a manually configured secondary room
- **GIVEN** the runtime has an attached originating room for user `kzf`
- **AND** a secondary room is manually created for user `gaubee`
- **WHEN** `kzf` asks `gaubee在吗？问他中午吃什么？`
- **THEN** the assistant first sends a message to the `gaubee` room
- **AND** unresolved attention remains active until the final answer is delivered back to the `kzf` room
- **AND** once the `gaubee` room replies `中午吃蛋炒饭。`, the assistant sends a user-visible answer back to the `kzf` room
- **AND** the assistant settles the related attention only after that originating-room answer is dispatched

#### Scenario: Manual compact preserves room facts for the next question
- **GIVEN** the runtime has already completed the relay and final answer above
- **WHEN** the user triggers `/compact` and then asks `中午吃什么`
- **THEN** the assistant answers correctly in the original `kzf` room from compacted factual history
- **AND** the assistant does not need a fresh relay through the `gaubee` room to answer that follow-up

#### Scenario: Cycle ingress starts from actor unread room state
- **WHEN** a runtime is about to start a new cycle or attach new attention during tool side effects
- **THEN** it first queries actor unread room state instead of scanning message rows for AI queue markers
- **THEN** it converts the selected unread room slices into attention-items for that round

#### Scenario: Selected unread messages become read when a real model request is dispatched
- **WHEN** a runtime has selected unread room messages for one outbound model request
- **AND** that outbound request is actually dispatched to the provider
- **THEN** the runtime marks those selected unread room messages as read
- **THEN** merely discovering unread candidates does not mark them read earlier

#### Scenario: Failed model work does not require unread rollback
- **WHEN** a dispatched model request later fails after the selected unread room messages were marked read
- **THEN** the related attention debt remains active through its score vectors
- **THEN** later cycles may query more room history through tools without pretending those same messages were never read

### Requirement: Session runtime SHALL bound unread room ingestion by configured room limits

Session runtime SHALL select unread room work using configuration-driven limits so one noisy room cannot starve all other rooms.

#### Scenario: Runtime selects only the configured number of focused unread rooms
- **WHEN** more unread rooms exist than `message.maxFocusedRoomCount`
- **THEN** the runtime selects only the highest-priority unread rooms up to that configured limit
- **THEN** lower-priority unread rooms remain pending for later rounds

#### Scenario: Runtime pages only the configured number of unread messages per room
- **WHEN** one selected room has more unread messages than `message.maxBatchReadRoomMessageCount`
- **THEN** the runtime only ingests the newest configured slice for that room in the current round
- **THEN** older unread history remains queryable through room pagination in later rounds or tools

### Requirement: Stop and abort SHALL have different runtime scopes

The runtime SHALL distinguish between stopping LoopBus work and destroying runtime-owned systems.

#### Scenario: Stop preserves channel state
- **WHEN** stop is invoked during an active session
- **THEN** the current model call is aborted and LoopBus stops
- **THEN** terminal and message control planes remain available

#### Scenario: Abort destroys runtime-owned systems
- **WHEN** abort is invoked
- **THEN** stop semantics happen first
- **THEN** terminal and message control planes are torn down for that runtime

### Requirement: Room-visible assistant output SHALL require explicit message mutations

Session runtime SHALL continue to ingest unread room work into attention, but room-visible assistant output MUST occur only when the model executes explicit message-system mutations. Attention commits alone SHALL remain internal, and visible room output SHALL still not count as completion until the related attention is settled separately. When one task spans an originating room and a secondary relay room, the originating room SHALL remain the owner of completion, and the factual answer MUST remain recoverable after a manual compact cycle.

#### Scenario: Model uses explicit message mutation for room output
- **WHEN** the model calls `message send`, `message edit`, or `message recall` for a room-backed task
- **THEN** the room transcript changes through message-system durable truth
- **AND** attention commits do not directly create room-visible rows

#### Scenario: Tool side effects do not hide room completion
- **WHEN** a runtime is about to start a new cycle or attach new attention during tool side effects
- **THEN** room-visible completion still requires explicit message-system mutation
- **AND** hidden tool-side state does not replace the required room reply
