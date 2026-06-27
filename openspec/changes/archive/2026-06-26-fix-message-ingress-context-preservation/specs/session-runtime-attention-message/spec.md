## ADDED Requirements

### Requirement: Message ingress SHALL preserve Avatar-owned attention context

Session runtime SHALL treat unread room messages as objective attention item facts. A message-system ingress commit SHALL NOT rewrite the room `attentionContext`; only Avatar-authored attention commits may update that context after processing the message.

#### Scenario: User message creates item without rewriting context
- **GIVEN** a room attention context contains an Avatar-authored topic summary
- **WHEN** a user room message is ingested into attention
- **THEN** an active attention item for the message is created with scores and source refs
- **AND** the room attention context content remains the Avatar-authored topic summary
- **AND** the message detail remains queryable through attention item/commit history

#### Scenario: Avatar may repair context after processing
- **GIVEN** a message-backed attention item is active
- **WHEN** the Avatar later commits its own attention update for the same context
- **THEN** that Avatar commit may update scores and rewrite the room attention context
