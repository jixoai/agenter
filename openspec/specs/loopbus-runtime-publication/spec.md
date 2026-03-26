## Purpose

Define the frontend-facing publication contract for LoopBus runtime state.
## Requirements
### Requirement: LoopBus runtime SHALL publish stable frontend-facing state
Runtime inspection state SHALL be published through explicit attention-native frame and trace contracts so frontend consumers can inspect scheduling behavior without depending on backend-private LoopBus assembly details.

#### Scenario: Runtime store ingests attention-native inspection state
- **WHEN** the backend publishes runtime frame and trace updates
- **THEN** client-sdk ingests the related attention refs, cycle-frame refs, trace spans, and terminal outcomes through explicit contracts
- **THEN** frontend selectors do not need to reconstruct runtime state from ad-hoc private fields

#### Scenario: Devtools renders published trace and frame state
- **WHEN** WebUI Devtools renders runtime execution details
- **THEN** it uses the published attention-native inspection contract
- **THEN** the surface does not require backend-private scheduler knowledge to remain correct

