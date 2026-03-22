## Purpose

Define the frontend-facing publication contract for LoopBus runtime state.

## Requirements

### Requirement: LoopBus runtime SHALL publish stable frontend-facing state
LoopBus runtime state, traces, and cycle-facing facts SHALL be published through explicit snapshot/realtime contracts so frontend consumers can inspect the runtime model without depending on backend-private implementation details.

#### Scenario: Runtime store ingests LoopBus state transitions
- **WHEN** the backend publishes LoopBus runtime state changes
- **THEN** client-sdk can ingest phase, cycle, trace, and error state through explicit contracts
- **THEN** frontend selectors do not need to reconstruct runtime state from ad-hoc fields

#### Scenario: Devtools renders published LoopBus traces
- **WHEN** WebUI devtools renders LoopBus execution details
- **THEN** it uses the published runtime snapshot/trace contracts
- **THEN** the surface does not require backend-private scheduler knowledge to remain correct
