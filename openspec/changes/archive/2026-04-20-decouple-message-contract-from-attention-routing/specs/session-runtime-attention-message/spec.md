## REMOVED Requirements

### Requirement: Session runtime SHALL route chat through attention and message adapters

**Reason**: The old requirement still mixes two directions that now need different laws: unread room facts may enter attention, but visible room output must no longer be routed out of attention automatically.

**Migration**: Keep room ingestion into attention, but replace committed reply-item routing with explicit `message send`, `message edit`, and `message recall` actions. Attention settlement remains a separate step after the visible room work is complete.

## ADDED Requirements

### Requirement: Session runtime SHALL ingest room work into attention while keeping room-visible output explicit

Session runtime SHALL continue to ingest unread room work into attention, but room-visible assistant output MUST occur only when the model executes explicit message-system mutations. Attention commits alone SHALL remain internal, and visible room output SHALL still not count as completion until the related attention is settled separately.

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
