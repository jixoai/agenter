## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, attachment previews, and the shared AI input composer over cycle or kernel inspection details.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the conversation stream plus the shared AI input composer
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Conversation-first chat still supports rich attachments
- **WHEN** messages contain persisted image, video, or file attachments
- **THEN** the Chat route keeps the conversation-first reading order
- **THEN** those attachments are rendered inline without turning the chat stream into a cycle-inspection view
