## MODIFIED Requirements

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
