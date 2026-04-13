## MODIFIED Requirements

### Requirement: Runtime shell routes land on the canonical heartbeat tab
The runtime shell SHALL expose a canonical runtime destination for each avatar session and SHALL route runtime entry URLs to `Heartbeat` without requiring feature-level navigation glue. Opening that route SHALL also trigger the data hydration needed for `Heartbeat`, `Attention`, and `Settings`, even when the shell starts from a cold browser state.

#### Scenario: Direct runtime entry hydrates backend facts on first load
- **WHEN** the operator opens `/avatars/runtime/{sessionId}/heartbeat` directly from a cold browser state
- **THEN** the shell hydrates persisted or live heartbeat history, attention/notification state, and runtime settings sources from backend APIs
- **AND** the first render does not depend on a prior websocket event or on visiting another page first

### Requirement: Heartbeat SHALL render one continuous AI-call runtime stream
The `Heartbeat` tab SHALL render the session heartbeat as one continuous runtime message surface backed by the session AI-call ledger. It SHALL present role-user and role-assistant messages as the dominant stream, SHALL include compact-boundary separator rows when prompt-window compaction restarts the bounded context, and SHALL treat virtualization as a list concern separate from message rendering primitives.

#### Scenario: Persisted heartbeat is visible on first route entry
- **WHEN** the operator opens `Heartbeat` for a session that already has durable heartbeat rows
- **THEN** the stage renders those persisted rows immediately after the initial backend hydration completes
- **AND** the operator is not left with an empty runtime pane while the durable ledger already contains messages

### Requirement: Attention main-area SHALL present one continuous runtime story
The `Attention` tab `main-area` SHALL remain a continuous runtime surface rather than a split dashboard. It SHALL present the selected `AttentionContext` first, then the currently focused context stack, and then the queued push inbox. Notification rows SHALL stay compact until they are promoted into active attention or resolved through `bottom-area` quick actions.

#### Scenario: Attention shows persisted or explicit empty state on first load
- **WHEN** the operator opens `Attention` from a direct runtime route
- **THEN** the stage renders current runtime attention facts when available, or a clear empty-state explanation when none exist
- **AND** the operator does not see a blank shell caused only by missing initial client hydration

### Requirement: Settings SHALL remain runtime-scoped and separate from workspace rules
The `Settings` tab SHALL preserve avatar-runtime configuration as a dedicated surface. Its `main-area` SHALL present runtime-scoped settings, its `bottom-area` SHALL expose save/reset/restart-style actions, and its detail sheet or drawer SHALL surface passive runtime metadata without taking over the page.

#### Scenario: Runtime settings expose prompt-source identity
- **WHEN** the operator opens `Settings`
- **THEN** the stage shows the selected runtime-scoped editable source together with its file path and modification identity
- **AND** runtime prompt sources such as `agenter`, `system`, `template`, or `contract` remain inspectable without leaving the runtime shell
