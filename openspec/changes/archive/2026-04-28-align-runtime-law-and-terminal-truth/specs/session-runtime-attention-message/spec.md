## MODIFIED Requirements

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
