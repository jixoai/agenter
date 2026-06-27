## ADDED Requirements

### Requirement: Runtime adapter ingress SHALL require explicit context mutation intent for apply

Runtime adapters SHALL default missing `contextMutation` to `preserve` when converting system ingress envelopes into attention commits. An adapter MAY request `apply` only when the target context is explicitly owned by that system projection rather than by Avatar-authored summarization.

#### Scenario: Missing context mutation is context-preserving
- **WHEN** an adapter emits a valid ingress envelope without `contextMutation`
- **THEN** the committed attention item preserves the target `attentionContext`
- **AND** the commit still advances history, head commit, and score state

#### Scenario: Source-owned projection opts into apply
- **WHEN** an adapter emits a valid ingress envelope with `contextMutation` set to `apply`
- **THEN** the attention commit may update the target context according to the commit change
