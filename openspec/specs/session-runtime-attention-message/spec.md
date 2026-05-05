# session-runtime-attention-message Specification

## Purpose

Define the durable law for how room-backed work enters attention, how room-visible messages are mutated, and how relay/follow-up behavior stays explicit instead of being inferred by the runtime.

## Requirements

### Requirement: Session runtime SHALL ingest room work as objective attention facts

Session runtime SHALL ingest unread room work into attention, but the ingested model-visible room fact SHALL contain only objective room/message truth. It MUST NOT infer reply ownership, social etiquette state, or settlement conditions from punctuation, room shape, or sender identity.

#### Scenario: Unread room work enters attention without auto-replying

- **WHEN** the runtime selects unread room work for a new round
- **THEN** it converts that room work into attention state for the model
- **AND** no visible assistant room message is created until the model later performs an explicit message mutation

#### Scenario: Punctuation-heavy ingress stays factual

- **WHEN** a room message contains `?` or `？`
- **THEN** the ingested room fact preserves the raw content, sender identity, and source refs
- **AND** the runtime does not emit `chatTurnState`, `chatObligationKind`, `settlesWhen`, `room_reply_pending`, or `self_update`

#### Scenario: Direct room ingress stays factual

- **WHEN** a two-seat room receives a message from the other participant
- **THEN** runtime records the message as a room fact
- **AND** runtime does not mark the message as `your_turn` or `room_reply_pending`

#### Scenario: Auth actor ingress stays factual

- **WHEN** a room message arrives from an `auth:*` actor in a group room
- **THEN** the runtime records sender identity as objective room fact
- **AND** it does not infer that the avatar must reply

### Requirement: Room-visible mutation SHALL require explicit message actions

Room-visible assistant output MUST occur only when the model executes explicit message-system mutations such as `message send`, `message edit`, or `message recall`. Attention commits, tool work, relay work, and runtime heuristics SHALL remain invisible to the room unless one of those explicit actions occurs.

#### Scenario: Explicit room mutation produces the visible reply

- **WHEN** the model calls `message send`, `message edit`, or `message recall` for a room-backed task
- **THEN** the runtime applies that authorized message-system mutation as the only source of visible room transcript change
- **AND** the related attention remains unresolved until the model also records the corresponding settlement

#### Scenario: Attention commit alone does not become a room row

- **WHEN** the model commits attention progress, summary changes, or cleanup without calling a message-system mutation
- **THEN** the room transcript remains unchanged
- **AND** the internal progress stays visible only through attention/runtime inspection surfaces

#### Scenario: Root or tool work does not prepend an acknowledgement

- **WHEN** room-backed work starts with `root_bash`, terminal work, relay work, or another non-message tool
- **THEN** the origin room transcript remains unchanged
- **AND** the runtime does not synthesize `originAckFallback`, auto-ACK text, or any other fallback visible room mutation

#### Scenario: Cross-room relay does not auto-acknowledge the origin room

- **WHEN** the model sends a message to a secondary visible room
- **THEN** only that explicit target-room message is created
- **AND** the origin room receives no automatic `originAckFallback` message

### Requirement: Room social context SHALL stay on explicit projection/query surfaces

Participants, presence, focused seats, and visible-room summaries are valid room facts, but they SHALL be supplied through explicit room/message projection surfaces rather than being eagerly inlined into every room-backed attention fact.

#### Scenario: Message-backed attention omits eager social envelope

- **WHEN** a room message is serialized into model-visible attention
- **THEN** it carries only the objective message fact plus source refs and attachment facts
- **AND** it does not inline full participants, presence, or visible-room arrays by default

#### Scenario: Room projections remain queryable

- **WHEN** the model needs room participants, presence, or visible rooms to decide the next action
- **THEN** it can obtain them through existing explicit room/message surfaces such as room snapshot/page reads, `message read`, or `message query`
- **AND** the returned data is labeled as room projection rather than as an already-decided obligation

#### Scenario: Projection replacement path stays explicit

- **WHEN** eager room social envelopes have been removed from message-backed attention
- **THEN** the implementation still preserves an explicit replacement path through existing room/message query contracts
- **AND** cleanup is not considered complete if eager injection was only deleted without leaving that path usable from model work

### Requirement: Relay and completion ownership SHALL remain explicit

When one task spans an originating room and a secondary relay room, the originating room remains the owner of user-visible completion. Relay progress is not the same thing as origin-room completion, and the runtime SHALL not hide that distinction behind automatic acknowledgements or settlement heuristics.

#### Scenario: Relay room send does not finish origin room

- **WHEN** the model sends a message to a secondary visible room first
- **THEN** only that explicit relay-room message is created
- **AND** unresolved attention remains active until the originating room receives the final answer

#### Scenario: Origin room completion happens only after explicit origin reply

- **WHEN** the relay room later returns the missing fact
- **THEN** the model still needs an explicit message mutation back into the origin room
- **AND** the related room-backed attention is not considered complete until that origin-room reply has been dispatched

### Requirement: Manual compact SHALL preserve durable room facts

Manual compact, cold start, or later replay assembly SHALL preserve durable room facts and visible answers without reintroducing hidden reply heuristics or requiring a new relay just to answer the same settled fact again.

#### Scenario: Compact preserves a settled origin-room answer

- **GIVEN** the runtime already delivered a final answer back to the origin room
- **WHEN** the user later triggers `/compact` and asks a direct factual follow-up in that same room
- **THEN** the runtime can answer from compacted durable facts
- **AND** it does not need to re-run the relay solely because the earlier answer left bounded prompt memory

### Requirement: Room etiquette MAY remain guidance, not fact

Room etiquette, acknowledgement style, relay conventions, and reply playbooks MAY remain in message-system guidance, but they SHALL NOT be serialized as already-decided room obligations or embedded as hidden room mutations.

#### Scenario: Message guidance can teach etiquette without deciding reply

- **WHEN** message guidance recommends how to acknowledge, relay, or close a room protocol
- **THEN** that recommendation may help the model choose its next explicit message action
- **AND** runtime still does not mark the room fact as `your_turn`, `room_reply_pending`, or otherwise already decided

### Requirement: Message follow-up compatibility SHALL remain a watch alias

If `followUpAfterMs` remains supported on `message send`, it SHALL stay a compatibility alias for the generic one-shot watch primitive. It creates later re-decision attention only, and SHALL NOT auto-send another room-visible message.

#### Scenario: Follow-up compatibility creates private reminder only

- **WHEN** `message send` is called with `followUpAfterMs`
- **THEN** the runtime binds a one-shot reminder to the sent durable `messageId`
- **AND** that reminder remains sender-private runtime scheduling state rather than shared room truth

#### Scenario: Follow-up compatibility uses a generic watch predicate

- **WHEN** `message send` receives `followUpAfterMs`
- **THEN** runtime creates a generic one-shot watch owned by the explicit message action
- **AND** the watch predicate references objective room state such as whether the sent message remains the latest visible fact

#### Scenario: Reminder expiry does not auto-send a room message

- **WHEN** the compatible follow-up reminder expires while its predicate still holds
- **THEN** the runtime creates only attention/watch reminder truth for re-decision
- **AND** any later room-visible reply still requires an explicit `message send`, `message edit`, or `message recall`
