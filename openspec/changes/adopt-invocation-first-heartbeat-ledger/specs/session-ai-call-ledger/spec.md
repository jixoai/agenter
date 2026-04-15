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

### Requirement: Assistant thinking SHALL persist as durable response-row parts

Assistant reasoning that arrives before final assistant text SHALL be persisted as durable `thinking` parts on the assistant response Heartbeat row.

#### Scenario: Thinking streams before assistant text

- **WHEN** the provider emits one or more assistant reasoning chunks before the assistant text is complete
- **THEN** the runtime updates the assistant response Heartbeat row in place with a `thinking` part
- **AND** that row remains the same durable assistant response row that later carries `text`
- **AND** grouped Heartbeat queries preserve the observable ordering between `thinking` and `text`

### Requirement: Changed config facts SHALL be linked durably to the next AI call

Runtime settings saves that change effective model knobs SHALL create one durable config fact now and let the next AI call link that fact objectively.

#### Scenario: Settings save creates a pending config fact before the next call exists

- **WHEN** an operator saves new model config while no new AI call has started yet
- **THEN** the runtime persists one loose `request_aux:config:*` fact
- **AND** the persistence layer does not mutate any current in-flight model call

#### Scenario: The next AI call consumes the pending config fact

- **WHEN** a later AI call starts after that config fact was persisted
- **THEN** the new `ai_call` links the durable config fact through `auxiliaryMessageIds`
- **AND** query-time Heartbeat grouping can project that fact into the next `before-call` group without rewriting the stored row
