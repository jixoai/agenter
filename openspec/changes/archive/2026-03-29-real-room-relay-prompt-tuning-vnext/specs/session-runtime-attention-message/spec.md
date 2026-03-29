## MODIFIED Requirements

### Requirement: Session runtime SHALL route chat through attention and message adapters

Session runtime SHALL ingest chat-channel inputs into attention and route reply items back into message-system through adapters. For chat-backed work, visible message dispatch alone MUST NOT count as completion; the related attention MUST remain unresolved until the assistant also records the settlement. When one task spans an originating room and a secondary relay room, the originating room SHALL remain the owner of completion, and the factual answer MUST remain recoverable after a manual compact cycle.

#### Scenario: Attention reply is delivered through message-system

- **WHEN** a committed attention item targets a chat channel reply
- **THEN** session runtime dispatches it through `messageSystem.reply`
- **THEN** the chat surface only receives message-system output, not raw attention facts

#### Scenario: Single-room reply stays unresolved until attention settles

- **WHEN** the assistant sends a user-visible reply into the current room for a chat-backed task
- **THEN** the runtime keeps the related attention active until the assistant records the corresponding settlement
- **THEN** the task is not considered complete while only the visible reply exists

#### Scenario: Main room request relays through a manually configured secondary room

- **GIVEN** the runtime has a default room for user `kzf`
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
