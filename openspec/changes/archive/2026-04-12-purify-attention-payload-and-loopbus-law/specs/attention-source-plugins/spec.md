## Requirements

### Requirement: Source adapters SHALL emit typed attention draft fields
Source adapters SHALL provide typed draft presentation, provenance, semantic identity, and egress intent fields instead of relying on open metadata bags for model-facing information.

#### Scenario: Message source builds a presentation body from message truth
- **WHEN** a message source is resolved into attention
- **THEN** the draft contains typed presentation fields derived from the message-system truth
- **AND** the draft does not require a later raw metadata dump to reconstruct the model-facing envelope

#### Scenario: Terminal semantic identity is preserved without generic metadata dumping
- **WHEN** a terminal source emits attention for a semantic change
- **THEN** the draft can still carry semantic identity hints for dedupe/backoff
- **AND** those hints are stored in typed draft fields rather than an open metadata bag that later leaks into commits or prompt payloads
