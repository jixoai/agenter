## MODIFIED Requirements

### Requirement: Viewer changes SHALL replay the current visibility fact once
When the host changes `viewerActorId`, the shared chat view SHALL treat that change as a new reader identity for read-ack projection. If the component already knows the current latest visible durable message, it SHALL re-emit that same visibility fact exactly once for the new viewer and SHALL stay idle afterwards until visibility advances again. The visibility fact SHALL carry the row `viewKey` plus the durable numeric `messageId` when one exists.

#### Scenario: Viewer switch replays the current latest visible message once
- **WHEN** the host changes `viewerActorId`
- **AND** the transcript still shows the same latest visible durable message
- **THEN** the component emits one visibility callback for that message, including its `viewKey` and numeric `messageId`
- **THEN** it does not keep replaying the same message again while the viewport stays unchanged

### Requirement: Web chat view SHALL render durable message revision state objectively
The shared transcript SHALL render room-message revision state from the durable message record itself instead of synthesizing extra transcript rows. The shared row lifecycle SHALL be keyed by `viewKey`, while room lifecycle updates delivered on the same durable numeric `messageId` SHALL update the existing room-backed row in place.

#### Scenario: Edited message updates the existing transcript row
- **WHEN** the transport delivers a later version of a room message with the same numeric `messageId` and a newer visible edited state
- **THEN** the transcript updates that existing row in place instead of appending a second corrective row
- **THEN** the row can expose that the message was edited from the durable record

#### Scenario: Recalled message stops rendering stale body content
- **WHEN** the transport delivers a recalled version of a room message on the same numeric `messageId`
- **THEN** the transcript renders that row as a recalled message
- **THEN** it does not keep showing the stale pre-recall body as the current message content

#### Scenario: Room pagination and hydration keep revision identity stable
- **WHEN** an edited or recalled room message appears through initial snapshot, reverse pagination, or later incremental updates
- **THEN** the shared merge logic resolves that lifecycle change through the same durable numeric `messageId`
- **THEN** the visible transcript row keeps its stable `viewKey`
- **THEN** the transcript does not duplicate the row just because the lifecycle state changed

## ADDED Requirements

### Requirement: Web chat view SHALL separate view identity from durable message identity
The shared chat package SHALL use `viewKey` as the UI merge and render identity for transcript rows. Durable room truth SHALL remain explicit as a separate numeric `messageId` field when the message originates from room transport.

#### Scenario: Room-backed message exposes both identities
- **WHEN** the host maps a durable room message into the shared chat view
- **THEN** the row exposes a stable string `viewKey`
- **THEN** the same row also exposes its numeric durable `messageId`
- **THEN** the shared package does not rename the UI key back to `messageId`

#### Scenario: Local non-durable row renders without a room message id
- **WHEN** a host or test fixture creates a local transcript row that has not been assigned a durable room message id
- **THEN** the row can still render and merge through `viewKey`
- **THEN** the absence of a numeric durable `messageId` does not break the shared transcript surface
