## ADDED Requirements

### Requirement: Model-facing room sends SHALL keep follow-up reminder intent out of durable room truth

Model-facing room sends MAY include an optional `followUpAfterMs` reminder intent for the sending runtime. When present, the control plane SHALL bind that reminder to the successfully sent durable `messageId`, but it SHALL keep the reminder in sender-private runtime scheduling state rather than in the durable room message row, room snapshot payloads, or incremental room transport updates. That reminder SHALL remain eligible only while the anchored message is still the latest visible room message in the room.

#### Scenario: Send with a follow-up reminder still persists a normal durable room message

- **WHEN** an authorized runtime sends a room message with `followUpAfterMs`
- **THEN** the durable room message is appended normally with the same visible room fields other readers expect
- **AND** the reminder intent is bound privately to that sent `messageId` instead of being serialized into shared room truth

#### Scenario: Room transport does not leak sender-private reminder state

- **WHEN** another authorized room reader later receives a snapshot, page read, or incremental transport update for that message
- **THEN** the payload does not expose `followUpAfterMs`, due times, or sender-private reminder lifecycle state
- **AND** shared room truth remains free of AI scheduling residue

#### Scenario: Newer visible room activity suppresses the older reminder

- **WHEN** a later visible room message appears before the anchored reminder reaches due time
- **THEN** the older reminder is no longer eligible to create later follow-up debt
- **AND** stale silence from the superseded message does not reopen the room by itself

### Requirement: Message skill SHALL teach follow-up reminders as etiquette-driven re-evaluation

The owning message skill guidance SHALL describe `followUpAfterMs` as an optional, one-shot etiquette aid for deciding later whether a room still needs feedback. That guidance SHALL not present the field as a mandatory rule, as a transport timeout, or as permission to auto-send a visible room message without another model decision.

#### Scenario: Long-running acknowledgement may arm a follow-up reminder

- **WHEN** the assistant sends a brief acknowledgement before longer work and wants to revisit the room if silence continues
- **THEN** the message skill may recommend `followUpAfterMs` on that acknowledgement
- **AND** the later action remains an explicit decision about whether another room reply is actually needed

#### Scenario: Skill guidance keeps follow-up reminders optional

- **WHEN** the assistant already has enough evidence for the final answer or later room activity has already changed the situation
- **THEN** the message skill does not require `followUpAfterMs`
- **AND** it does not frame the reminder as universal policy for every room message
