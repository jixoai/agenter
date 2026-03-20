## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, and the shared AI input composer over cycle or kernel inspection details, and it SHALL preserve that reading flow for real persisted session histories as well as fresh mocked sessions.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the conversation stream plus the shared AI input composer
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Chat does not default to cycle inspection cards
- **WHEN** the Chat route renders existing session history
- **THEN** it does not present collected-facts summaries, cycle badges, or other cycle-inspection cards as the default reading structure
- **THEN** user-facing chat content remains readable without understanding LoopBus internals

#### Scenario: Real persisted history stays visible when the viewport virtualizes
- **WHEN** the active session contains enough persisted chat rows to switch the viewport into its virtualized rendering path
- **THEN** the conversation rows remain visible in the Chat stage instead of collapsing into an empty or zero-width viewport
- **THEN** the user can still read the latest visible conversation without leaving the Chat route

## ADDED Requirements

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
