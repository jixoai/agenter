## MODIFIED Requirements

### Requirement: Source adapters SHALL emit typed attention draft fields
Source adapters SHALL provide typed draft presentation, provenance, and semantic identity fields instead of relying on open metadata bags for model-facing information. If a source expects a visible effect in another system, that expectation SHALL be represented as model-visible attention content plus system skill guidance, and the effect SHALL still require an explicit system mutation.

#### Scenario: Message source builds a presentation body from message truth
- **WHEN** a message source is resolved into attention
- **THEN** the draft contains typed presentation fields derived from the message-system truth
- **AND** the draft does not require a later raw metadata dump to reconstruct the model-facing envelope

#### Scenario: Terminal semantic identity is preserved without generic metadata dumping
- **WHEN** a terminal source emits attention for a semantic change
- **THEN** the draft can still carry semantic identity hints for dedupe/backoff
- **AND** those hints are stored in typed draft fields rather than an open metadata bag that later leaks into commits or prompt payloads

#### Scenario: Task source facts stay in the draft body instead of the source ref
- **WHEN** a task source emits attention about a changed task file or heartbeat
- **THEN** any AI-visible source/path/file facts are represented in the draft content or presentation body
- **AND** the source ref itself remains limited to typed scheduler coordinates
