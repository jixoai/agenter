## ADDED Requirements

### Requirement: Devtools technical panels SHALL use one shared tool invocation renderer
All Devtools technical surfaces that present tool execution lifecycle MUST render through one shared invocation card contract rather than panel-specific tool blocks.

#### Scenario: Cycle detail uses shared invocation cards
- **WHEN** cycle evidence contains a tool call/result lifecycle
- **THEN** Devtools renders the lifecycle via the shared invocation card
- **THEN** status, payload sections, and error rendering follow the same contract used by other technical panels

#### Scenario: Chat transcript is excluded from technical invocation renderer
- **WHEN** the user reads the Chat route
- **THEN** Chat does not render technical tool invocation cards
- **THEN** tooling lifecycle inspection remains in Devtools-only technical panels
