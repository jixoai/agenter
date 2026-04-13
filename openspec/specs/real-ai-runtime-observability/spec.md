# real-ai-runtime-observability Specification

## Purpose
Define the shared observability contract for monitored real-provider scenario runners and scenario-scoped test Avatar personas.

## Requirements

### Requirement: Real-provider scenario runners SHALL use dedicated test Avatar personas
Opt-in real-provider scenario runners SHALL mount scenario-scoped test Avatars instead of relying on the shared default Avatar prompt state.

#### Scenario: Single-avatar runner mounts a scenario-scoped `AGENTER.mdx`
- **WHEN** a monitored real-provider runner starts a single-avatar scenario such as relay, weather, or room-terminal delivery
- **THEN** it creates or reuses a test-only Avatar nickname for that scenario
- **AND** it writes a dedicated `AGENTER.mdx` for that Avatar before runtime boot
- **AND** the runner reports the Avatar nickname and prompt-path identity in its diagnostics

#### Scenario: Team runner mounts per-participant `AGENTER.mdx`
- **WHEN** a monitored real-provider runner starts a multi-avatar collaboration scenario
- **THEN** backend and frontend participants each receive their own dedicated test Avatar persona
- **AND** the runner diagnostics preserve which prompt identity was mounted for each participant

### Requirement: Monitored real-provider runners SHALL emit live progress facts
Monitored runners SHALL report objective progress while a scenario is still executing so engineers can inspect live state and stop early when no progress is happening.

#### Scenario: Live monitor reports ledger, model, and room facts
- **WHEN** a monitored real-provider runner is executing
- **THEN** it periodically emits elapsed time, `message_part` counts by scope, current `ai_call` statuses, the latest room-truth message, and the latest tool-trace tool names
- **AND** the output is derived from current runtime or `session.db` facts rather than guessed stage labels

### Requirement: Monitored real-provider runners SHALL persist durable evidence on success and failure
Monitored runners SHALL export a durable evidence bundle whether the scenario succeeds or fails.

#### Scenario: Successful run exports a settled session-db snapshot
- **WHEN** a monitored real-provider runner reaches its success checkpoint
- **THEN** it copies the scenario `session.db` to a durable temp path after the observed model activity for that checkpoint has settled
- **AND** it prints the session id, session root, snapshot path, and segmented timing summary

#### Scenario: Failed run exports a durable evidence bundle
- **WHEN** a monitored real-provider runner times out or fails validation
- **THEN** it copies the current `session.db` to a failure snapshot path
- **AND** it prints recent room truth, recent model diagnostics, and scenario-relevant evidence such as delivery URL, attachment state, or workspace file state
