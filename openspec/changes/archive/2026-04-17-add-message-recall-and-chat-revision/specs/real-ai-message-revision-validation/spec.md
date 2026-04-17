## ADDED Requirements

### Requirement: Real-provider validation SHALL prove draft-to-edit room correction
The system SHALL provide an opt-in real-provider validation that creates a fresh room-facing assistant context and proves the assistant can naturally revise one previously sent durable room message in place after learning better facts, without the prompt naming the `edit` command explicitly.

#### Scenario: Assistant edits a draft after verification
- **WHEN** the validation prompt induces the assistant to send an early draft before gathering the final fact
- **THEN** the assistant eventually updates that same durable room message in place instead of appending a second final answer
- **THEN** the validation output captures objective room evidence showing one `messageId` with an edit lifecycle update

### Requirement: Real-provider validation SHALL prove recall-before-resend behavior
The system SHALL provide an opt-in real-provider validation that proves the assistant can withdraw an unsuitable durable room draft and then send a replacement final reply, without the prompt naming the `recall` command explicitly.

#### Scenario: Assistant recalls a draft before sending the final reply
- **WHEN** the validation prompt induces the assistant to send an unsuitable draft that should not remain visible in the room
- **THEN** the assistant recalls that draft before posting the replacement final message
- **THEN** the validation output captures objective room evidence showing the original `messageId` entering recalled state and a later replacement `messageId`

### Requirement: Validation evidence SHALL remain objective and inspectable
Real-provider message-revision validation SHALL write objective artifacts that let engineers inspect what actually happened during the run.

#### Scenario: Validation writes transcript evidence for later inspection
- **WHEN** a draft-edit or draft-recall scenario completes or fails
- **THEN** the validation writes transcript or room-message evidence under `.chat`
- **THEN** that evidence preserves message ordering, message ids, and lifecycle updates well enough to distinguish `send + send` from `send + edit` and `send + recall + send`
