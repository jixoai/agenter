## MODIFIED Requirements

### Requirement: Heartbeat tool lifecycle SHALL persist as invocation-first ledger rows

Runtime persistence SHALL treat each tool invocation as a stable Heartbeat message keyed by `aiCallId + invocationId`, instead of rebuilding tool visibility from a synthetic assistant response snapshot.

#### Scenario: Tool decision creates a durable running invocation row

- **WHEN** the provider emits a `tool_call` decision for one invocation
- **THEN** the runtime persists a canonical `scope=heartbeat_part` row for that invocation immediately
- **AND** the row contains a `tool_call` part linked by `invocationId`
- **AND** the row remains incomplete until a corresponding `tool_result` exists

#### Scenario: Tool arguments hydrate before completion

- **WHEN** the runtime later learns better invocation arguments for the same `invocationId`
- **THEN** it updates the same invocation Heartbeat row in place
- **AND** the operator can see the hydrated parameters without waiting for tool completion

#### Scenario: Tool completion appends result without changing row identity

- **WHEN** local tool execution finishes for one invocation
- **THEN** the same invocation Heartbeat row gains a `tool_result` part
- **AND** the invocation row identity remains stable before and after completion
- **AND** the runtime does not split the same invocation across separate post-completion Heartbeat rows

### Requirement: Assistant response Heartbeat rows SHALL not embed tool execution facts

Assistant response Heartbeat rows SHALL persist assistant-authored parts only. Tool execution facts SHALL live in invocation rows.

#### Scenario: Assistant text and tool lifecycle coexist in one ai_call

- **WHEN** one AI call emits assistant text plus one or more tool invocations
- **THEN** the assistant response Heartbeat row contains only assistant-authored parts such as `thinking` and `text`
- **AND** each tool invocation persists in its own invocation-linked Heartbeat row
- **AND** Heartbeat does not depend on `response.toolTrace` snapshot reconstruction to show tool lifecycle
