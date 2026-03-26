# attention-trace-spans Specification

## Purpose
TBD - created by archiving change attention-trace-otel-vnext. Update Purpose after archive.
## Requirements
### Requirement: Runtime SHALL persist attention-native trace spans
The runtime SHALL record execution as trace spans, events, and links keyed by stable attention-native references instead of ad-hoc step/detail strings.

#### Scenario: Source read becomes a trace span
- **WHEN** the runtime reads an invalidated source into attention drafts
- **THEN** it records a trace span for that source read with the related source reference and context reference
- **THEN** the committed attention items created from that read are linked back to the same trace lineage

#### Scenario: Model work links to the causing attention items
- **WHEN** a cycle starts model work from one or more committed attention items
- **THEN** the runtime records a model-call trace span linked to the selected item refs and cycle-frame ref
- **THEN** downstream tool calls and egress dispatch spans can link back to that same causal chain

### Requirement: Trace spans SHALL encode terminal outcomes and causal links
Trace data SHALL distinguish successful completion, recoverable error, explicit stop, explicit abort, and downstream dispatch failure without relying on textual inference.

#### Scenario: Stop and abort are recorded differently
- **WHEN** the scheduler is stopped without runtime teardown
- **THEN** the active trace span records a stop-oriented terminal outcome
- **THEN** the trace does not imply that the whole runtime instance was destroyed

#### Scenario: Abort records teardown semantics
- **WHEN** the runtime aborts and destroys owned systems
- **THEN** the active span records an abort-oriented terminal outcome
- **THEN** later inspection can distinguish teardown from a normal stop or timeout

