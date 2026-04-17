## ADDED Requirements

### Requirement: Runtime Heartbeat publication SHALL preserve assistant response segments objectively

The runtime Heartbeat ledger SHALL persist assistant `thinking` and `text` spans as chronological response segments instead of collapsing them into one mutable assistant snapshot for the whole AI call.

#### Scenario: Thinking can resume after a tool boundary without losing order

- **WHEN** one AI call emits `thinking`, then a tool invocation, then more `thinking`, then final assistant text
- **THEN** the durable Heartbeat ledger preserves those assistant spans as separate chronological response segments
- **AND** later inspection can reconstruct the objective order without guessing from the latest aggregate assistant body

### Requirement: Grouped Heartbeat projection SHALL compare auxiliary facts by payload truth

Grouped Heartbeat publication SHALL deduplicate ordinary request-side auxiliary facts by payload equivalence rather than by message-id churn, while still attaching compact-specific prompt facts to the compact call that uses them.

#### Scenario: Unchanged ordinary prompt facts do not create a fresh before-call replay

- **WHEN** two consecutive ordinary AI calls reuse the same durable `systemPrompt`, `tools`, or `config` payloads
- **THEN** the grouped Heartbeat projection does not emit a new `before-call` replay just because the durable auxiliary message ids changed
- **AND** only materially changed auxiliary facts appear as new pre-call rows

#### Scenario: Compact-specific prompt facts stay attached to the compact call

- **WHEN** a compact cycle records compact-only prompt facts and then records the compact boundary/result
- **THEN** the grouped Heartbeat projection keeps those compact prompt facts attached to the compact call
- **AND** the operator does not need to read a separate ordinary `before-call` card to understand that compact event

### Requirement: Runtime Heartbeat publication SHALL expose running invocation intent once durable input exists

The grouped Heartbeat publication SHALL treat a running invocation row with meaningful durable input as an objective running tool fact instead of as a pending placeholder.

#### Scenario: Running tool row stays objective before the result arrives

- **WHEN** a durable `tool_call` row already exposes invocation parameters but has not yet received a `tool_result`
- **THEN** the grouped Heartbeat publication keeps that row in the running state
- **AND** consumers can inspect the durable parameters on the existing row before completion
