## ADDED Requirements

### Requirement: Web chat view SHALL render durable message revision state objectively
The shared transcript SHALL render room-message revision state from the durable message record itself instead of synthesizing extra transcript rows. Message lifecycle updates delivered on the same `messageId` SHALL update the existing row in place.

#### Scenario: Edited message updates the existing transcript row
- **WHEN** the transport delivers a later version of a message with the same `messageId` and a newer visible edited state
- **THEN** the transcript updates that existing row in place instead of appending a second corrective row
- **THEN** the row can expose that the message was edited from the durable record

#### Scenario: Recalled message stops rendering stale body content
- **WHEN** the transport delivers a recalled version of a message on the same `messageId`
- **THEN** the transcript renders that row as a recalled message
- **THEN** it does not keep showing the stale pre-recall body as the current message content

#### Scenario: Room pagination and hydration keep revision identity stable
- **WHEN** an edited or recalled message appears through initial snapshot, reverse pagination, or later incremental updates
- **THEN** the shared merge logic still resolves that message by the same `messageId`
- **THEN** the transcript does not duplicate the row just because the lifecycle state changed
