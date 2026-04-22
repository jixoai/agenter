## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage

The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, avatars, restrained time dividers, attachment previews, the shared AI input composer, and message-system-native collaboration state over cycle or kernel inspection details. For shared rooms, surrounding route chrome SHALL not surface a synthetic room-level latest-progress summary; collaboration read state stays attached to message rows.

#### Scenario: Group chat keeps read state on message rows only

- **WHEN** the user is viewing a shared room conversation
- **THEN** each message row may expose its own read-progress affordance at inline-end
- **AND** surrounding route chrome does not expose a synthetic “current room latest progress” summary
- **AND** the UI does not treat a room-level latest-visible badge as collaboration truth
