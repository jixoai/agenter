## ADDED Requirements

### Requirement: Runtime skills SHALL make debt-only attention handling discoverable under minimal bootstrap
When a model round is bootstrapped only by `AttentionContexts.metadata`, the visible runtime skill surface SHALL still tell the AI how to inspect the current debt and how to settle it after the real side effect is complete.

#### Scenario: skills.list exposes debt-only wake guidance
- **WHEN** the runtime renders `skills.list` into the system prompt
- **THEN** the visible summary tells the AI to inspect attention with `attention list/query` when the round is driven only by attention metadata
- **AND** it tells the AI to use `attention commit --done` or `--score 0` after the real side effect and final owning-room report already happened

#### Scenario: agenter-attention skill expands into explicit settle examples
- **WHEN** the AI opens `ccski info agenter-attention`
- **THEN** the expanded skill includes explicit examples for inspecting the owning context and settling it with `attention commit`
- **AND** the examples do not claim that `message send` alone automatically completes the task
