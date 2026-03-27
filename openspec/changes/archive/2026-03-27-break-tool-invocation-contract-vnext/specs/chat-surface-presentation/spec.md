## MODIFIED Requirements

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
Technical tool lifecycle messages SHALL use `channel: tool` and remain excluded from the default Chat conversation stream.

#### Scenario: Tool lifecycle is hidden from Chat narrative
- **WHEN** runtime emits assistant messages with `channel: tool`
- **THEN** Chat conversation projection excludes those rows from the user-facing transcript
- **THEN** tool lifecycle remains inspectable in Devtools and terminal technical panels
