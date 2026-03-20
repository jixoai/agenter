## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL own cycle-oriented, terminal-oriented, task-oriented, LoopBus-oriented, and model-oriented inspection details that are not part of the default Chat narrative. The cycle-oriented inspection surface SHALL be presented as a live timeline instead of a default accordion dump.

#### Scenario: Devtools opens as the technical inspection surface
- **WHEN** the user opens the Devtools route for a workspace session
- **THEN** the route exposes technical inspection panels for the active session instead of conversation-first chat content
- **THEN** technical details removed from the default Chat route remain available in Devtools

#### Scenario: Cycle inspection shows a live timeline
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes the cycle-oriented view as a live timeline with cycle identity, status, and related inspection access
- **THEN** those details remain available even though they are no longer the default structure of Chat
