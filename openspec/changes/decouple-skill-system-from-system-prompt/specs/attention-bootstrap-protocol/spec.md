## MODIFIED Requirements

### Requirement: Attention bootstrap SHALL use a two-stage `context` + `items` protocol
The first attention-native model inputs for a round SHALL be split into a bootstrap `context` document and a delta `items` payload. `context` SHALL carry rendered attention-context snapshots such as the canonical skill snapshot surface, while `items` SHALL carry only unresolved attention deltas and reminder facts. Runtime systems SHALL NOT reintroduce prompt-owned skill glue outside this protocol.

#### Scenario: Bootstrap context is emitted before delta items
- **WHEN** runtime collects model inputs for a round with bootstrap-visible attention contexts
- **THEN** it emits one bootstrap input whose protocol kind is `context`
- **AND** that input appears before any `items` input for the same round

#### Scenario: Skill snapshot reaches the model through rendered attention context instead of system prompt glue
- **WHEN** runtime assembles the bootstrap `context` for a round that includes the canonical skill snapshot context
- **THEN** the bootstrap input includes the rendered skill snapshot content
- **AND** the runtime does not splice the same skill list into `AGENTER_SYSTEM` or any other prompt-owned bootstrap string

#### Scenario: Delta items stay fact-only
- **WHEN** runtime serializes unresolved attention into the `items` payload
- **THEN** the text contains only unresolved facts and reminders
- **AND** rendered context snapshots are not duplicated there as scored fact items unless a system explicitly emits a reminder commit for them
