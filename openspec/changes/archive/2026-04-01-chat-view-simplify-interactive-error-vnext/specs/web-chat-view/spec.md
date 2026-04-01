## ADDED Requirements

### Requirement: Web chat view SHALL render typed channel rows
Web chat view MUST render channel rows by message kind (`text`, `error`, `interactive`) instead of inferring technical semantics from markdown payloads.

#### Scenario: Error rows render as channel system/error cards
- **WHEN** the channel stream includes an `error` row
- **THEN** web chat view renders a distinct error card in the transcript
- **THEN** the row remains part of normal channel history and pagination

#### Scenario: Interactive rows render lightweight form cards
- **WHEN** the channel stream includes an `interactive` row
- **THEN** web chat view renders a lightweight interactive form card
- **THEN** submitting that form sends one normal text message to the same channel
