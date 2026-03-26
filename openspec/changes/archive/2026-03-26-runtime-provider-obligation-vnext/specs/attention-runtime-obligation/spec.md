## MODIFIED Requirements

### Requirement: Attention runtime scheduling SHALL preserve unresolved obligation semantics
The runtime SHALL treat `score >= 1` as unresolved attention debt even when scheduler containment places the work into `backoff` or `blocked` state.

#### Scenario: Blocked debt stays unresolved
- **WHEN** attention debt cannot make progress because the resolved provider or configuration is invalid
- **THEN** the runtime publishes that debt as unresolved with an explicit containment posture such as `blocked` or `backoff`
- **AND** the system does not present that debt as if it had been semantically completed

#### Scenario: Solvable debt progresses with the resolved provider
- **WHEN** unresolved attention debt is scheduled with a valid, callable provider
- **THEN** the runtime continues model/tool work until the relevant scores are mutated toward zero or a new explicit containment state is reached
- **AND** the selected provider reflects the resolved settings, not a silent fallback provider
