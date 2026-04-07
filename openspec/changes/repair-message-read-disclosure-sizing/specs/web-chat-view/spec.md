## MODIFIED Requirements

### Requirement: Web chat view SHALL render canonical avatar and message action affordances

The shared chat package SHALL support host-provided canonical avatar/icon resolution for room and actor identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation.

#### Scenario: Inline-end read indicator disclosure keeps a readable compact width
- **WHEN** the operator opens a message-local read disclosure on desktop or compact viewport
- **THEN** the disclosure renders as a readable card instead of collapsing to content width
- **THEN** compact layouts may collapse to one column, but they still keep the disclosure fully legible within the viewport
