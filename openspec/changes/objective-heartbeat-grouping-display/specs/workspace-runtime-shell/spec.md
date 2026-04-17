## ADDED Requirements

### Requirement: Heartbeat compact cycles SHALL render as one special card

The Heartbeat surface SHALL render a compact cycle as one special card that keeps the compact prompt facts and the compact result in the same visual event.

#### Scenario: Compact mode folds compact prompt facts into one card

- **WHEN** a `before-call` prompt-fact group immediately precedes a `compact` group for the same `aiCallId`
- **THEN** the Heartbeat surface renders one compact card instead of two separate cards
- **AND** compact mode keeps the prompt facts folded while still showing the compact result clearly

#### Scenario: Detailed mode reveals the exact compact prompt facts in the same card

- **WHEN** the operator switches that compact card into detailed mode
- **THEN** the same card reveals the compact system prompt, tool inventory, and other prompt facts
- **AND** the operator still sees the compact result in chronological context without leaving that card

### Requirement: Heartbeat tool rows SHALL expose running intent objectively

The Heartbeat surface SHALL expose a running tool row as `Running` as soon as the durable row already contains meaningful invocation parameters.

#### Scenario: Parameters are visible before completion

- **WHEN** the Heartbeat surface renders a running tool row with durable parameters but no result yet
- **THEN** the row label shows that the tool is running
- **AND** the parameters are visible on that same row before the final result arrives

### Requirement: Heartbeat top paging SHALL keep one dedicated loading affordance

The top-of-stream older-page affordance SHALL stay above the grouped Heartbeat cards and SHALL switch into a disabled loading affordance while an older-page request is in flight.

#### Scenario: Older-page loading stays attached to the top of the stream

- **WHEN** the operator requests older grouped Heartbeat history from the top affordance
- **THEN** the same top affordance region shows a loading indicator in the disabled state
- **AND** the first visible Heartbeat group stays below that loading region instead of overlapping it
