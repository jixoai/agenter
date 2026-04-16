## ADDED Requirements

### Requirement: Heartbeat footer SHALL present objective runtime status and context details

The `Heartbeat` footer SHALL derive its primary status label from runtime scheduler containment facts rather than from frontend inference over the latest model-call row. The same footer SHALL render context usage, optional max-context progress, and optional estimated cost from the newest available model-call usage plus canonical provider metadata when that metadata exists.

#### Scenario: Scheduler truth drives the footer status label
- **WHEN** the runtime scheduler reports `running`, `waiting`, `backoff`, `blocked`, `paused`, or `idle`
- **THEN** the Heartbeat footer shows that objective containment state using scheduler facts such as `runtimeStatus` and `waitingReason`
- **AND** the UI does not label the state as `Waiting for AI call` solely because the latest model call is absent or not running

#### Scenario: Footer context falls back cleanly when provider metadata is incomplete
- **WHEN** the newest model call includes token usage but the active provider lacks `maxContextTokens` or pricing metadata
- **THEN** the Heartbeat footer still shows the available usage facts
- **AND** max-context progress or estimated cost stays disabled, hidden, or explicitly unavailable instead of inventing values

### Requirement: Heartbeat SHALL distinguish first-load, empty, refreshing, and error states

The `Heartbeat` tab SHALL project its grouped message-parts stream through an explicit resource state rather than treating `no groups mounted` as the only empty condition.

#### Scenario: First load is not mistaken for an empty ledger
- **WHEN** the operator opens `Heartbeat` before the first grouped Heartbeat page has loaded
- **THEN** the stage shows a loading state
- **AND** it does not show the `No Heartbeat rows yet` empty-state copy until the grouped resource has actually loaded empty

#### Scenario: Warm refresh preserves visible rows
- **WHEN** the grouped Heartbeat resource is already loaded and a refresh is triggered by realtime invalidation or manual pagination
- **THEN** the existing Heartbeat rows remain visible
- **AND** the stage only adds a secondary refresh signal instead of clearing the transcript back to blank or empty state

### Requirement: Heartbeat footer SHALL expose manual compact as a control action

The `Heartbeat` footer SHALL expose a dedicated compact action that triggers a manual compact cycle through runtime control rather than by inserting a chat command into the transcript.

#### Scenario: Operator triggers compact from the footer
- **WHEN** the operator clicks the `Compact` button in the Heartbeat footer
- **THEN** the runtime queues a manual compact request for that session
- **AND** the transcript does not gain a fake `/compact` user message just to trigger the cycle

#### Scenario: Compact boundary still appears as durable Heartbeat truth
- **WHEN** the manual compact request later completes
- **THEN** Heartbeat records and renders the resulting compact boundary in chronological order
- **AND** the boundary remains a normal durable Heartbeat fact rather than a special UI-only marker

### Requirement: Heartbeat grouped virtualization SHALL remeasure disclosure-driven height changes

Grouped Heartbeat virtualization SHALL preserve one virtualized conversation surface while still responding correctly to row-height changes caused by expand/collapse or layout-mode switches.

#### Scenario: Expanding a grouped Heartbeat card does not leave stale blank space
- **WHEN** the operator expands or collapses a Heartbeat group card within the virtualized stream
- **THEN** the virtualized conversation recalculates the affected row height
- **AND** the scroll range does not retain stale whitespace below the final visible rows
