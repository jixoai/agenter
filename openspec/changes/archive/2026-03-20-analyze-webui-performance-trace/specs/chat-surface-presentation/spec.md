## MODIFIED Requirements

### Requirement: Workspace Chat SHALL preserve long-session pagination and live turn continuity
The WebUI SHALL keep one stable conversation viewport while prepending older persisted pages and appending optimistic or streamed turns for the active session. When a persisted long-history session is restored, the route SHALL reopen on the latest visible conversation turn instead of stranding the user at an arbitrary earlier midpoint.

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

#### Scenario: Restored history opens on the latest visible conversation turn
- **WHEN** the user opens a persisted workspace session that already contains long chat history
- **THEN** the Chat viewport restores the latest visible user-facing turn without manual scrolling
- **THEN** the route still allows scrolling upward to earlier persisted history inside the same viewport
