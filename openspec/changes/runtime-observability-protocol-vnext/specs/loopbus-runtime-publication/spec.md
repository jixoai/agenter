## MODIFIED Requirements

### Requirement: Runtime observability SHALL publish stable frontend-facing state through scheduler and trace contracts
The frontend-facing runtime publication contract SHALL expose scheduler state, scheduler input signals, and runtime trace facts through explicit scheduler/observability contracts instead of public `loopbus*` names.

#### Scenario: Runtime store ingests scheduler state transitions
- **WHEN** the backend publishes runtime scheduler state changes
- **THEN** client-sdk ingests phase, cycle, wake, and input-signal state through scheduler-named contracts
- **THEN** frontend consumers do not depend on `runtime.loopbus.*` event names to remain correct

#### Scenario: Devtools renders runtime traces through the public observability contract
- **WHEN** WebUI Devtools renders execution detail and observability history
- **THEN** it consumes runtime trace contracts that are published as observability resources
- **THEN** the surface does not need a `loopbusTrace` compatibility layer
