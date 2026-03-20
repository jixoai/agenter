## Purpose

Define the conversation-first presentation contract for the workspace Chat route.
## Requirements
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

### Requirement: Workspace Chat SHALL expose one primary session action and one actionable status summary
The WebUI SHALL expose exactly one primary session action inside the Chat route, and it SHALL summarize route-relevant runtime state into one actionable notice or passive status instead of stacking multiple competing technical statuses.

#### Scenario: Stopped session offers one clear recovery path
- **WHEN** the active session is stopped
- **THEN** the Chat toolbar shows one primary session control for starting the session
- **THEN** the surrounding status copy explains the most relevant next step without simultaneously repeating multiple raw runtime states

#### Scenario: Route summary prefers actionable guidance over vague fallback errors
- **WHEN** the Chat route receives an unclassified or generic error condition
- **THEN** the route renders a stable user-facing summary instead of the raw text `Unknown error`
- **THEN** the summary either offers a recovery action or explains what part of the session failed in neutral language

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

### Requirement: Workspace Chat SHALL preserve long-session pagination and live turn continuity
The WebUI SHALL keep one stable conversation viewport while prepending older persisted pages and appending optimistic or streamed turns for the active session.

#### Scenario: Older persisted history prepends without hiding the current conversation
- **WHEN** the user loads earlier chat pages for a long-running session
- **THEN** older rows are prepended into the same conversation viewport
- **THEN** the currently visible conversation does not disappear or reset to an empty state

#### Scenario: Optimistic and streamed turns remain visible during real-session activity
- **WHEN** the user sends a new message in a session that already has persisted history
- **THEN** the optimistic user turn appears immediately in the conversation stream
- **THEN** any streamed assistant reply remains visible in place until the persisted assistant message arrives

#### Scenario: Attachment-bearing turns remain readable in long histories
- **WHEN** the Chat route renders persisted or optimistic turns that include attachments
- **THEN** those turns continue to show attachment metadata and previews in the same message-first conversation flow
- **THEN** the presence of attachments does not force the route back to cycle-oriented rendering

