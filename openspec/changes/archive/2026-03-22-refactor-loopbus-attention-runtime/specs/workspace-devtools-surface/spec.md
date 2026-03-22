## MODIFIED Requirements

### Requirement: Devtools SHALL reflect the published LoopBus runtime model
The Devtools surface SHALL inspect LoopBus runtime state and traces through the explicit publication contract introduced by the LoopBus runtime refactor.

#### Scenario: Devtools renders cycle phases from published runtime state
- **WHEN** the session runtime publishes LoopBus phases and trace entries
- **THEN** Devtools renders those phases and traces from the published contract
- **THEN** UI logic does not depend on backend-private LoopBus state assembly
