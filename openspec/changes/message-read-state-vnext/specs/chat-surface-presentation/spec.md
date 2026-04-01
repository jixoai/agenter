## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage

The WebUI SHALL render group chat with conversation-first message flow plus message-system-native collaboration status such as read progression, instead of elevating runtime attention debt as the main room status affordance.

#### Scenario: Group chat shows read progress instead of pending strip
- **WHEN** the user is viewing a shared room conversation
- **THEN** the primary room status affordance summarizes who has read the conversation or latest message
- **THEN** the UI does not treat "pending for attention" as the main collaboration summary for that room
