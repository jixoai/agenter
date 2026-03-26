## MODIFIED Requirements

### Requirement: Chat SHALL only show user-facing assistant output
The Chat surface SHALL render user input and assistant replies intended for users, while internal attention-system activity remains outside the primary transcript.

#### Scenario: Attention updates stay out of Chat
- **WHEN** the runtime processes an internal attention update during a cycle
- **THEN** the Chat transcript does not render that update as an assistant reply
- **THEN** only explicit user-facing assistant output appears in Chat

#### Scenario: Optimistic user messages deduplicate by identity
- **WHEN** an optimistic user turn and a persisted cycle share the same `clientMessageId`
- **THEN** Chat renders exactly one user message row for that turn
- **THEN** the optimistic row is replaced by the persisted one without a duplicate transcript entry

#### Scenario: Long history opens on the latest persisted turns
- **WHEN** the user opens a session with a long persisted transcript
- **THEN** the Chat route initially shows the latest persisted turns instead of landing in the middle of the conversation
- **THEN** reverse-scrolling still reveals the oldest persisted turns and their attachments without duplicate transcript rows
