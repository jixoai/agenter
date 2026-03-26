## ADDED Requirements

### Requirement: Message hook extracts human-readable summaries
The runtime MUST attempt a message-system send when an avatar-authored attention commit belongs to a context bound to a chat channel and the commit summary is non-empty.

#### Scenario: Eligible commit becomes one chat message
- **GIVEN** a context bound to `chat-main`
- **AND** the current avatar commits a non-empty summary
- **WHEN** the commit is applied
- **THEN** the message hook sends exactly one message to `chat-main`
- **AND** the hook result is reported as delivered.

#### Scenario: Ineligible commit is ignored
- **GIVEN** a commit without enough objective information for message extraction
- **WHEN** the commit is applied
- **THEN** no automatic chat message is sent
- **AND** the hook result is reported as ignored.
