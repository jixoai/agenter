## MODIFIED Requirements

### Requirement: Workspace Chat SHALL expose one primary session action and one actionable status summary
The WebUI SHALL expose exactly one primary session action inside workspace-route chrome owned by the Chat route, and it SHALL summarize route-relevant runtime state into one actionable notice or passive status instead of stacking multiple competing technical statuses. The session action MUST NOT live inside the scrollable chat transcript card.

#### Scenario: Chat session action lives in workspace header chrome
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the state-driven start-or-stop action is rendered in the workspace header area
- **THEN** the transcript surface keeps conversation content and composer as its own stage without a duplicated chat-internal toolbar

### Requirement: Workspace Chat SHALL preserve long-session pagination and live turn continuity
The WebUI SHALL keep one stable conversation viewport while prepending older persisted pages and appending optimistic or streamed turns for the active session. The transcript viewport SHALL remain the only primary scroll owner for the message history, while the composer remains fixed below it.

#### Scenario: Chat keeps one deliberate transcript scroll owner
- **WHEN** the Chat route renders long history or active streaming content
- **THEN** the message transcript scrolls inside one dedicated conversation viewport
- **THEN** the composer stays visible outside that scrolling region
