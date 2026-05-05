## ADDED Requirements

### Requirement: Message-backed attention SHALL contain raw room facts only

Session runtime SHALL ingest unread room work as objective message facts. It MUST NOT infer social obligations, turn ownership, or settlement criteria from sender identity, room size, punctuation, or message text.

#### Scenario: Question mark does not create platform obligation
- **WHEN** a room message from another actor contains `?` or `？`
- **THEN** the ingested message fact preserves the raw content and sender identity
- **AND** runtime does not emit `chatTurnState`, `chatObligationKind`, `settlesWhen`, `room_reply_pending`, or `self_update`

#### Scenario: Direct room does not imply reply pending
- **WHEN** a two-seat room receives a message from the other participant
- **THEN** runtime records the message as a room fact
- **AND** runtime does not mark the message as `your_turn` or `room_reply_pending`

#### Scenario: Auth actor does not imply reply pending
- **WHEN** a group room receives a message from an `auth:*` sender
- **THEN** runtime records the sender actor id as fact
- **AND** runtime does not infer that the avatar must reply

### Requirement: Room-visible output SHALL require explicit message mutation

Session runtime SHALL mutate room transcripts only when the model or operator performs an explicit message mutation. Tool work, relay work, attention commits, or cross-room sends MUST NOT cause runtime-authored fallback acknowledgements.

#### Scenario: Root tool work does not auto-acknowledge
- **WHEN** a chat-backed cycle invokes `root_bash` before sending a room reply
- **THEN** the origin room transcript remains unchanged
- **AND** no fallback acknowledgement such as `收到，我先处理一下。` is created

#### Scenario: Cross-room relay does not auto-acknowledge origin
- **WHEN** the model sends a message to a secondary visible room
- **THEN** only that explicit target-room message is created
- **AND** the origin room receives no automatic `originAckFallback` message

#### Scenario: Attention commit does not create a room row
- **WHEN** the model commits attention progress or settlement without calling `message send`, `message edit`, or `message recall`
- **THEN** no room transcript row is created or modified

### Requirement: Room social context SHALL be queryable projection

Participants, presence, focused seats, and visible-room summaries SHALL be available through explicit room projection/query surfaces instead of being eagerly attached to every message fact.

#### Scenario: Message fact omits eager social projection
- **WHEN** a new room message is ingested into attention
- **THEN** the model-visible message fact does not inline full participant, presence, or visible-room summary arrays by default

#### Scenario: Model can query room projection
- **WHEN** the model needs participants, presence, or visible rooms to decide an action
- **THEN** it can use the existing explicit room/message surfaces such as room snapshot/page reads, `message read`, or `message query` according to the needed scope
- **AND** the returned projection is labeled as derived room projection rather than a new obligation

#### Scenario: Projection replacement path stays explicit
- **WHEN** eager room social envelope has been removed from message-backed attention
- **THEN** the implementation still preserves an explicit replacement path through the existing message/query contracts
- **AND** the cleanup is not considered complete if it only deletes eager injection without leaving those explicit query paths usable from model work

### Requirement: Room etiquette MAY remain guidance, not fact

Room etiquette, acknowledgement style, relay conventions, and reply playbooks MAY remain in message-system guidance, but they SHALL NOT be serialized as already-decided room obligations or embedded as hidden room mutations.

#### Scenario: Message guidance can teach etiquette without deciding reply
- **WHEN** message guidance recommends how to acknowledge, relay, or close a room protocol
- **THEN** that recommendation may help the model choose its next message action
- **AND** runtime still does not mark the room fact as `your_turn`, `room_reply_pending`, or otherwise already decided

### Requirement: Message follow-up compatibility SHALL delegate to generic watch law

If message tooling retains `followUpAfterMs` for compatibility, the field SHALL be implemented as an alias for the generic watch primitive and SHALL NOT encode message-specific etiquette or automatic room reply behavior.

#### Scenario: Message follow-up creates watch
- **WHEN** `message send` receives a compatible `followUpAfterMs`
- **THEN** runtime creates a generic one-shot watch owned by the explicit message action
- **AND** the watch predicate references objective room state such as whether the message remains the latest visible fact

#### Scenario: Follow-up expiry does not send a message
- **WHEN** the compatible follow-up watch expires while its predicate still holds
- **THEN** runtime creates a reminder for model re-decision
- **AND** runtime does not send a room reply automatically
