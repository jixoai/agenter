## MODIFIED Requirements

### Requirement: Heartbeat SHALL render one continuous AI-call runtime stream

The `Heartbeat` tab SHALL render the session heartbeat as one continuous runtime inspection surface backed by durable ledger facts and model-call facts. It SHALL present user/assistant messages, compact boundaries, request-side auxiliary changes, and model-call execution cards without collapsing all runtime behavior into plain chat bubbles.

#### Scenario: Heartbeat shows durable request-side auxiliary facts

- **WHEN** the operator opens `Heartbeat` for a session whose runtime changed `systemPrompt`, `tools`, or `config`
- **THEN** the stage renders those durable request-side auxiliary facts in timeline order
- **AND** the operator can inspect the payload without leaving the Heartbeat surface

#### Scenario: Heartbeat shows model-call execution context

- **WHEN** the operator opens `Heartbeat`
- **THEN** the stage renders model-call cards with provider/model/status plus persisted assistant response details such as text, thinking, or tool trace when available
- **AND** the stage can augment the currently running model call with live delta facts while the runtime is active

### Requirement: Settings SHALL remain runtime-scoped and separate from workspace rules

The `Settings` tab SHALL preserve avatar-runtime configuration as a dedicated runtime-scoped settings graph surface. It SHALL explain effective values, source layers, and provenance jumps for the current runtime scope instead of degrading into a single-file editor.

#### Scenario: Runtime Settings flatten workspace scope with avatar scope

- **WHEN** the operator opens `Settings` for a running avatar session
- **THEN** the stage resolves scoped settings using the runtime workspace plus the current avatar nickname
- **AND** the effective view reflects avatar-specific overrides on top of workspace or global layers

#### Scenario: Runtime Settings jump from effective value to source layer

- **WHEN** the operator selects a provenance source from the effective settings view
- **THEN** the stage jumps to the matching source layer
- **AND** the layer editor focuses the mapped pointer instead of leaving the operator in a disconnected single-file editor

