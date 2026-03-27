## ADDED Requirements

### Requirement: Terminal activity SHALL render tool lifecycle entries via the shared invocation card
Tool-related terminal activity rows MUST map to the same shared invocation renderer used in Devtools cycle/model technical surfaces.

#### Scenario: Terminal tool activity shows unified lifecycle state
- **WHEN** terminal activity includes a tool invocation record
- **THEN** the activity row renders one shared invocation card
- **THEN** call/result/error payloads follow the same YAML-first visualization contract
