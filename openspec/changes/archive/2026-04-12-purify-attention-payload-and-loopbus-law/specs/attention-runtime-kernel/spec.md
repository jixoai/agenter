## Requirements

### Requirement: Runtime SHALL treat attention body as the model-visible truth
The runtime SHALL ensure that any system detail the model needs is represented in attention body content or typed tools, not in hidden metadata side channels.

#### Scenario: Source-specific context survives payload simplification
- **WHEN** a message, terminal, or task source produces attention that needs extra context for model reasoning
- **THEN** runtime writes that context into the attention body's rendered detail content
- **AND** the model does not need hidden metadata to understand the work

### Requirement: LoopBus transport metadata SHALL remain scheduler-only
LoopBus transport metadata SHALL only carry scheduler/protocol facts needed for orchestration, persistence, or inspection. Business data and AI-relevant content SHALL NOT depend on that metadata.

#### Scenario: Attention input keeps persistence refs without content leakage
- **WHEN** runtime emits bootstrap or delta attention inputs into LoopBus
- **THEN** transport metadata may include `attentionContextIds`, `attentionCommitRefs`, or compact flags
- **AND** room social context, terminal payload detail, and other AI-visible facts remain in the body text instead of transport metadata
