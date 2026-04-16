## MODIFIED Requirements

### Requirement: Heartbeat footer SHALL present objective runtime status and context details

The `Heartbeat` footer SHALL derive its primary status label from runtime scheduler containment facts rather than from frontend inference over the latest model-call row. The same footer SHALL render context usage through the shared AI-elements `Context` composition, using the newest available model-call usage plus canonical provider metadata when that metadata exists. When provider metadata is incomplete, the footer SHALL keep the objective usage facts visible and SHALL disable, hide, or degrade the unavailable context details instead of inventing values.

#### Scenario: Scheduler truth drives the footer status label

- **WHEN** the runtime scheduler reports `running`, `waiting`, `backoff`, `blocked`, `paused`, or `idle`
- **THEN** the Heartbeat footer shows that objective containment state using scheduler facts such as `runtimeStatus` and `waitingReason`
- **AND** the UI does not label the state as `Waiting for AI call` solely because the latest model call is absent or not running

#### Scenario: Footer context uses the shared AI-elements surface

- **WHEN** the newest model call includes usage facts and the active provider exposes context metadata
- **THEN** the Heartbeat footer renders those facts through the shared AI-elements `Context` trigger/content structure
- **AND** the footer does not replace that contract with a bespoke local badge block

#### Scenario: Footer context falls back cleanly when provider metadata is incomplete

- **WHEN** the newest model call includes token usage but the active provider lacks `maxContextTokens` or pricing metadata
- **THEN** the Heartbeat footer still shows the available usage facts
- **AND** max-context progress or estimated cost stays disabled, hidden, or explicitly unavailable instead of inventing values

## ADDED Requirements

### Requirement: Heartbeat running group headers SHALL maintain live elapsed durations

Grouped Heartbeat headers SHALL show their start timestamp immediately and SHALL keep the running elapsed duration ticking from wall-clock time while the underlying group is still open.

#### Scenario: Running group duration advances without fresh Heartbeat rows

- **WHEN** a Heartbeat group is still running and no new Heartbeat row arrives for several seconds
- **THEN** the header duration continues to update from wall-clock time
- **AND** the operator does not need a new row or rerender-triggering event to see the elapsed time advance

#### Scenario: Completed group freezes its final duration

- **WHEN** a Heartbeat group stops running because its durable rows are complete
- **THEN** the header shows the final elapsed duration derived from the durable start and end timestamps
- **AND** the clock stops ticking further

### Requirement: Heartbeat top-of-stream pagination SHALL occupy a dedicated flow lane

The grouped Heartbeat transcript SHALL reserve a dedicated top-of-stream lane for older-page pagination so the affordance never overlaps the first group card.

#### Scenario: Pagination affordance sits above the first group row

- **WHEN** older Heartbeat groups are available and the operator reaches the top of the stream
- **THEN** the `Load older` affordance renders in its own lane above the first visible group row
- **AND** it does not visually overlap or occlude the first group card

#### Scenario: Loading older groups shows a disabled loader treatment

- **WHEN** the operator requests older Heartbeat groups and that pagination request is still pending
- **THEN** the top-of-stream affordance becomes disabled
- **AND** its content switches from static button text to a loading treatment
