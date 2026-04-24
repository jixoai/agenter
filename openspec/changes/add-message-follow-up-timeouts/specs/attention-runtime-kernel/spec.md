## ADDED Requirements

### Requirement: Eligible message follow-up reminders SHALL mature into committed attention

When a message-bound follow-up reminder reaches due time and its anchor message is still eligible, the runtime SHALL create one committed attention item in the corresponding room context. That committed attention SHALL reference the originating `chatId` and anchor `messageId` so the AI can decide whether silence or slow progress warrants another visible room reply.

#### Scenario: Due reminder creates one follow-up decision obligation

- **WHEN** a sent room message armed `followUpAfterMs`
- **AND** that anchored message is still the latest visible room message when the due time arrives
- **THEN** the runtime commits one follow-up attention item for the same room context
- **AND** that attention item references the anchored `messageId` so later model work can judge the next reply from room context

#### Scenario: Stale anchored reminders do not create new debt

- **WHEN** a message-bound reminder reaches due time after the room has already moved on to a newer visible message
- **THEN** the runtime does not commit a new follow-up attention item from that stale reminder
- **AND** newer room activity remains the only live source of room debt

#### Scenario: Reminder expiry never auto-sends a room message

- **WHEN** a message follow-up reminder reaches due time
- **THEN** the runtime does not append a visible room message from the reminder alone
- **AND** any later room reply still requires an explicit `message send`, `message edit`, or `message recall`

#### Scenario: Reminder fires at most once

- **WHEN** a message follow-up reminder has already committed its due attention item or has already been suppressed as stale
- **THEN** the runtime does not re-arm or re-commit that same reminder automatically
- **AND** a later reminder requires a new explicit message send
