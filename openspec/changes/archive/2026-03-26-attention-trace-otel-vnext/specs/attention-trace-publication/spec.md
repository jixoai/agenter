## ADDED Requirements

### Requirement: Runtime SHALL publish trace snapshots and incremental trace events
The runtime SHALL publish trace snapshots for hydration and incremental trace events for live inspection, both keyed by stable attention-native references.

#### Scenario: A client hydrates trace state for an active session
- **WHEN** a Devtools client subscribes to trace inspection for an active session
- **THEN** it receives a trace snapshot containing currently known spans, events, and links
- **THEN** subsequent runtime work arrives as incremental trace events without requiring a full snapshot rebuild

#### Scenario: Trace publication remains stable across hot runtime updates
- **WHEN** the runtime emits many trace events during one cycle
- **THEN** subscribers receive a consistent ordered publication stream
- **THEN** the published contract does not require reconstructing private backend state from raw logs

### Requirement: Trace publication SHALL support lookup by stable refs
Trace consumers SHALL be able to locate trace history from attention refs, cycle-frame refs, model-call refs, and egress refs.

#### Scenario: Inspect trace from an attention item
- **WHEN** a consumer requests trace details for an attention item reference
- **THEN** the runtime can return the related spans and linked downstream work for that item
- **THEN** the consumer does not need a separate backend-private correlation id

#### Scenario: Inspect trace from a model call
- **WHEN** a consumer requests trace details for a model-call reference
- **THEN** the runtime can return the causal span chain leading into and out of that model call
- **THEN** linked attention items and cycle frames remain discoverable from that trace payload
