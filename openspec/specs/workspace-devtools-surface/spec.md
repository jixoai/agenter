## Purpose

Define the dedicated technical inspection surface for workspace Devtools.

## Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL own cycle-oriented, terminal-oriented, task-oriented, LoopBus-oriented, and model-oriented inspection details that are not part of the default Chat narrative.

#### Scenario: Devtools opens as the technical inspection surface
- **WHEN** the user opens the Devtools route for a workspace session
- **THEN** the route exposes technical inspection panels for the active session instead of conversation-first chat content
- **THEN** technical details removed from the default Chat route remain available in Devtools

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect session cycles and related factual inputs or internal assistant records without requiring those facts to appear in the default Chat flow.

#### Scenario: Cycle inspection shows collected facts and internal records
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes a cycle-oriented view that shows cycle identity and related factual inspection content such as collected inputs or internal assistant records
- **THEN** those details remain available even though they are no longer the default structure of Chat

### Requirement: Devtools SHALL keep expert tabs separate from Chat chrome
The WebUI SHALL keep its technical inspection tabs inside Devtools, and those tabs MUST NOT be duplicated as default disclosure inside the Chat route.

#### Scenario: Technical tabs stay inside Devtools
- **WHEN** the user navigates between Devtools panels such as cycles, terminal, tasks, LoopBus, or model inspection
- **THEN** the application keeps those inspection affordances within the Devtools route
- **THEN** the Chat route does not duplicate the same technical panel hierarchy in its main surface
