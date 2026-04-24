## ADDED Requirements

### Requirement: Runtime-local message send SHALL expose object-JSON follow-up reminder intent

The runtime-local `message send` command SHALL accept an optional positive integer `followUpAfterMs` on the standard object JSON payload. Help text and built-in skill guidance SHALL describe this field as a one-shot reminder that later creates attention only if the sent message still represents the latest visible room state. The runtime SHALL not require a new compact positional encoding for this field in this change.

#### Scenario: Object JSON send accepts `followUpAfterMs`

- **WHEN** the AI runs `root_bash` with `command="message send"` and JSON `stdin` containing `chatId`, `content`, and `followUpAfterMs`
- **THEN** the runtime validates that payload and dispatches the room send successfully
- **AND** the reminder intent rides on the object JSON request without altering the visible room payload schema

#### Scenario: Invalid `followUpAfterMs` is rejected before send

- **WHEN** the AI sends `message send` object JSON with a non-integer or non-positive `followUpAfterMs`
- **THEN** the runtime rejects that payload through normal descriptor validation
- **AND** no durable room message is appended

#### Scenario: Help explains that follow-up reminder is not auto-reply

- **WHEN** the AI runs `message send --help`
- **THEN** the help surface documents `followUpAfterMs`
- **AND** the help explains that due expiry creates a later attention item instead of an automatic visible room message

#### Scenario: Reminder callers stay on object JSON instead of compact positional mode

- **WHEN** the AI wants to send a room message with `followUpAfterMs`
- **THEN** the documented supported surface is the standard object JSON payload
- **AND** the runtime does not require a new compact positional slot in order to use the reminder
