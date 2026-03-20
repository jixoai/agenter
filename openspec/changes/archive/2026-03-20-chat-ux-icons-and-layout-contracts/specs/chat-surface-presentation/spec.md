## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, avatars, restrained time dividers, attachment previews, and the shared AI input composer over cycle or kernel inspection details.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the conversation stream plus the shared AI input composer
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Conversation-first chat still supports rich attachments
- **WHEN** messages contain persisted image, video, or file attachments
- **THEN** the Chat route keeps the conversation-first reading order
- **THEN** those attachments are rendered inline without turning the chat stream into a cycle-inspection view

#### Scenario: Conversation flow uses restrained time dividers
- **WHEN** adjacent chat messages are separated by a meaningful time gap or a date boundary
- **THEN** the Chat route inserts a centered time or date divider into the transcript
- **THEN** the divider stays visually secondary to the message bubbles

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
The WebUI SHALL keep technical assistant facts and cycle metadata accessible for expert inspection, but those facts MUST NOT dominate the default Chat reading flow and MUST be hidden behind expert affordances such as per-message context menus or explicit navigation to Devtools.

#### Scenario: Internal assistant channels are not rendered as the primary chat narrative
- **WHEN** a session contains internal assistant facts such as attention updates, tool-call payloads, or collected-input summaries
- **THEN** those facts are not rendered as the primary human-facing conversation narrative in Chat
- **THEN** the user-facing conversation still remains available in chronological order

#### Scenario: Expert cycle access remains contextual
- **WHEN** the user opens a message-level expert action menu from Chat
- **THEN** the menu can expose the related Devtools navigation or cycle reference
- **THEN** the default transcript surface still avoids visible cycle terminology
