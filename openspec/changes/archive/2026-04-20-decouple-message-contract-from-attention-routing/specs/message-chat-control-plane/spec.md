## ADDED Requirements

### Requirement: Durable room messages SHALL use explicit same-room reply references

The message control plane SHALL expose an optional numeric `ref` on durable room messages to represent “this room message replies to that other durable room message in the same chat”. Room messages MUST NOT expose runtime cycle ids, attention commit ids, or any other internal routing anchor as part of this reply-reference field.

#### Scenario: Authorized room send stores a same-room reply reference

- **WHEN** an authorized caller sends a room message with `ref` pointing to another durable `messageId` in the same room
- **THEN** the persisted room message stores that reply reference as durable room truth
- **THEN** later snapshot, pagination, and incremental transport reads expose the same `ref` unchanged

#### Scenario: Internal anchors do not become room reply references

- **WHEN** a caller attempts to send a room message with a non-room anchor such as a runtime cycle id, attention id, or another non-message token in the reply-reference field
- **THEN** the control plane rejects that write instead of persisting the value as durable room truth
- **THEN** room messages remain free of runtime or attention routing residue

#### Scenario: Referenced message lifecycle stays objective

- **WHEN** a room message references another durable room message that is later edited or recalled
- **THEN** the referencing message keeps the same `ref`
- **THEN** later room reads can still resolve the referenced durable message and observe its current objective lifecycle state

## MODIFIED Requirements

### Requirement: Message-system SHALL define communication semantics through skills and attention

The message control plane SHALL express room-facing obligations through durable message facts and attention items, and the owning message skill guidance SHALL describe message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch instead of reducing room CLI usage to mechanical quote forwarding, and it SHALL explicitly teach post-send revision behavior through `message read`, `message edit`, and `message recall`.

#### Scenario: Message skill teaches role-aware relay
- **WHEN** room work requires the assistant to use message-system
- **THEN** the message skill explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Message attention items preserve assistant role boundaries
- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the message skill and message-shaped attention items remind it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime

#### Scenario: Message skill distinguishes send edit and recall
- **WHEN** the assistant already has a durable room message and later learns it is incomplete, stale, or should be withdrawn
- **THEN** the skill explains when to send a second message, when to edit the prior message in place, and when to recall it before replying again
- **AND** the guidance treats `send`, `edit`, and `recall` as separate message-system actions rather than as one overloaded command

#### Scenario: Post-send revision guidance reads room context before withdrawing duplicates
- **WHEN** the assistant has just sent a durable room message and the returned recent room summary suggests that two of its recent messages may be accidental duplicates
- **THEN** the guidance instructs the assistant to inspect room context with `message read` before acting
- **AND** that reread includes direct referenced room context when present
- **AND** the assistant withdraws or edits a message only when the duplicate is a contextual mistake rather than a deliberate repeated response
