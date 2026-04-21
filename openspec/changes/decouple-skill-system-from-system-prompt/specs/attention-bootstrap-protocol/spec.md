## MODIFIED Requirements

### Requirement: Attention bootstrap SHALL use a three-stage `summary` + `context` + `items` protocol
The first attention-native model inputs for a round SHALL be split into a bootstrap `summary` document, a bootstrap `context` document, and a delta `items` payload. `summary` SHALL carry the minimal pre-call round summary, `context` SHALL carry `AttentionContexts.metadata` plus rendered attention-context snapshots such as the canonical skill snapshot surface, and `items` SHALL carry only unresolved attention deltas and reminder facts. Runtime systems SHALL NOT reintroduce prompt-owned skill glue outside this protocol.

#### Scenario: Bootstrap summary and context are emitted before delta items
- **WHEN** runtime collects model inputs for a round with bootstrap-visible attention contexts
- **THEN** it emits one bootstrap input whose protocol kind is `summary`
- **AND** it emits one bootstrap input whose protocol kind is `context`
- **AND** those inputs appear in `summary -> context -> items` order for the same round

#### Scenario: Skill snapshot reaches the model through summary and rendered attention context instead of system prompt glue
- **WHEN** runtime assembles the bootstrap `summary` and `context` for a round that includes the canonical skill snapshot context
- **THEN** the summary input contains `## PreAICallContext Summary`
- **AND** the context input contains `## AttentionContexts.metadata`
- **AND** the context input includes the rendered skill snapshot content
- **AND** the runtime does not splice the same skill list into `AGENTER_SYSTEM` or any other prompt-owned bootstrap string

#### Scenario: Delta items stay fact-only
- **WHEN** runtime serializes unresolved attention into the `items` payload
- **THEN** the text contains only unresolved facts and reminders
- **AND** rendered context snapshots are not duplicated there as scored fact items unless a system explicitly emits a reminder commit for them
