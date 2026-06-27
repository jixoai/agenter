## ADDED Requirements

### Requirement: Runtime source facts SHALL preserve Avatar-owned attention context by default

Runtime source ingress SHALL treat external facts, scheduler reminders, task changes, terminal observations, and room lifecycle records as attention item/detail facts unless the ingress explicitly declares that the target context is a source-owned projection. These commits SHALL preserve the current `attentionContext` content, slots, and content format while still updating commit history, head commit, and score state.

#### Scenario: Room reminder preserves topic summary
- **GIVEN** a room context contains an Avatar-authored topic summary
- **WHEN** a due follow-up reminder is emitted for that room
- **THEN** the reminder creates a queryable attention commit
- **AND** the room `attentionContext` content remains the Avatar-authored topic summary

#### Scenario: Room lifecycle preserves topic summary
- **GIVEN** a room context contains an Avatar-authored topic summary
- **WHEN** room lifecycle facts such as focus, update, archive, delete, or grant changes are committed
- **THEN** those lifecycle facts remain queryable in attention history
- **AND** the room `attentionContext` content remains the Avatar-authored topic summary

#### Scenario: Task and terminal facts preserve context summaries
- **GIVEN** task or terminal contexts contain Avatar-authored summaries
- **WHEN** task changes or terminal snapshots/diffs are committed from runtime source ingress
- **THEN** their detail payloads remain queryable through attention history
- **AND** the current `attentionContext` summaries remain unchanged
