## ADDED Requirements

### Requirement: Web chat view SHALL render first-class room reply previews

The shared chat transcript SHALL render room-message references as a first-class preview surface instead of relying on quote-like body text conventions. When a room message carries `ref`, the row SHALL render a compact preview of the referenced durable room message and SHALL keep that preview synchronized with the referenced message's current objective lifecycle state.

#### Scenario: Replying room message renders a compact referenced preview

- **WHEN** the transcript renders a room message whose `ref` points to another durable room message
- **THEN** the row shows a compact preview of the referenced message above or alongside the new body
- **THEN** the preview is driven from structured room message data rather than from manually embedded quote text

#### Scenario: Referenced recalled message stays objective in the preview

- **WHEN** the referenced room message has been recalled
- **THEN** the reply preview renders the recalled state instead of stale pre-recall body text
- **THEN** the referencing room row remains in place with the same `ref`

#### Scenario: Referenced message outside the visible transcript window can still preview

- **WHEN** the current transcript window contains a room message whose referenced target is not otherwise present in the visible `items`
- **THEN** the shared chat view can still render that preview from sidecar referenced message data
- **THEN** the host does not need a second route-local lookup path to make reply previews work
