## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL own cycle-oriented, terminal-oriented, task-oriented, LoopBus-oriented, and model-oriented inspection details that are not part of the default Chat narrative.

#### Scenario: Devtools opens as the technical inspection surface
- **WHEN** the user opens the Devtools route for a workspace session
- **THEN** the route exposes technical inspection panels for the active session instead of conversation-first chat content
- **THEN** technical details removed from the default Chat route remain available in Devtools

#### Scenario: Chat can deep-link into Devtools inspection
- **WHEN** the user activates an advanced action on a chat message that has related technical cycle context
- **THEN** the application opens Devtools for the same workspace session
- **THEN** the related cycle is selected in the Devtools cycle inspection view

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect session cycles and related factual inputs or internal assistant records without requiring those facts to appear in the default Chat flow.

#### Scenario: Cycle inspection shows collected facts and internal records
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes a cycle-oriented view that shows cycle identity and related factual inspection content such as collected inputs or internal assistant records
- **THEN** those details remain available even though they are no longer the default structure of Chat

#### Scenario: Cycle inspection remains explicit on compact layouts
- **WHEN** the application is rendered on a compact viewport
- **THEN** the user still reaches cycle inspection through the Devtools route or an explicit advanced action
- **THEN** cycle identity is not promoted into the primary Chat viewport
