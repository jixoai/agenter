## MODIFIED Requirements

### Requirement: Request-side auxiliary model payloads SHALL remain inspectable as durable ledger facts

Request-side payloads that are siblings of `messages` in the model request body, including `systemPrompt`, `tools`, and `config`, SHALL remain queryable through runtime inspection contracts in addition to being persisted in `message_parts`.

#### Scenario: Runtime inspection pages request auxiliary rows

- **WHEN** a runtime inspection client pages request-side auxiliary facts for one session
- **THEN** it receives durable rows derived from `scope=request_aux`
- **AND** each row preserves `partType`, payload, timestamps, round identity, and related model-call identity
- **AND** the projection does not require the client to open `session.db` directly
