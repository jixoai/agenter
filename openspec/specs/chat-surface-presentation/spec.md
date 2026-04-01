## Purpose

Define the conversation-first presentation contract for the workspace Chat route.
## Requirements
### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, avatars, restrained time dividers, attachment previews, the shared AI input composer, and message-system-native collaboration state over cycle or kernel inspection details.

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

#### Scenario: Group chat shows read progress instead of pending strip
- **WHEN** the user is viewing a shared room conversation
- **THEN** the primary room status affordance summarizes who has read the conversation or latest message
- **THEN** the UI does not treat "pending for attention" as the main collaboration summary for that room

### Requirement: Workspace Chat SHALL expose one primary session action and one actionable status summary
The WebUI SHALL expose exactly one primary session action inside the Chat route, and it SHALL summarize route-relevant runtime state into one actionable notice or passive status instead of stacking multiple competing technical statuses. The primary session action SHALL be rendered through one compact route-local session status pill menu rather than through header-level action chrome.

#### Scenario: Stopped session offers one clear recovery path
- **WHEN** the active session is stopped
- **THEN** the Chat route shows one route-local session status pill that exposes the start action
- **THEN** the surrounding status copy explains the most relevant next step without simultaneously repeating multiple raw runtime states

#### Scenario: Route summary prefers actionable guidance over vague fallback errors
- **WHEN** the Chat route receives an unclassified or generic error condition
- **THEN** the route renders a stable user-facing summary instead of the raw text `Unknown error`
- **THEN** the summary either offers a recovery action or explains what part of the session failed in neutral language

#### Scenario: Session controls do not expand the top header
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the top header stays passive and compact
- **THEN** start, stop, resume, and abort controls stay inside the route-local session status pill menu

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
Technical tool lifecycle messages SHALL use `channel: tool` and remain excluded from the default Chat conversation stream.

#### Scenario: Tool lifecycle is hidden from Chat narrative
- **WHEN** runtime emits assistant messages with `channel: tool`
- **THEN** Chat conversation projection excludes those rows from the user-facing transcript
- **THEN** tool lifecycle remains inspectable in Devtools and terminal technical panels

### Requirement: Composer helper content SHALL collapse before primary actions degrade
The shared Chat composer SHALL use adaptive affordances so helper copy collapses into a secondary help affordance before primary actions lose their semantic prominence.

#### Scenario: Helper hints collapse into a rich tooltip
- **WHEN** the composer container becomes too narrow to keep all helper chips visible
- **THEN** the helper content collapses into a `?` affordance that opens a rich tooltip or popover
- **THEN** the send flow remains visible without helper text noise

#### Scenario: Secondary attachment controls become icon-only when needed
- **WHEN** the composer container remains narrow after helper collapse
- **THEN** attachment and screenshot controls may hide their labels while keeping icon-only buttons
- **THEN** the primary send action still remains clearly identifiable

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

### Requirement: Workspace Chat SHALL virtualize long-lived transcripts
The Chat route SHALL virtualize transcript rows regardless of history size thresholds so years-long sessions remain responsive while preserving prepend-anchor stability.

#### Scenario: Very long history remains responsive
- **WHEN** the session contains a very large transcript
- **THEN** Chat renders the conversation through a virtualized list instead of mounting every row
- **THEN** loading an older page keeps the visible anchor stable
