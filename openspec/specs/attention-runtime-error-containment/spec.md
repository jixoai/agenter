# attention-runtime-error-containment Specification

## Purpose
TBD - created by archiving change attention-runtime-error-containment. Update Purpose after archive.
## Requirements
### Requirement: Attention debt SHALL remain active without forcing immediate model re-entry
The runtime SHALL treat unresolved attention scores as durable debt, but SHALL only launch a new model round when an explicit runnable wake cause exists.

#### Scenario: Unresolved debt waits without spinning
- **WHEN** a cycle ends with one or more related attention scores still greater than zero and no new wake cause is present
- **THEN** the runtime keeps that debt recorded as unresolved
- **THEN** the scheduler transitions to `waiting`, `backoff`, or `blocked` instead of immediately starting another model call

#### Scenario: A valid wake cause reactivates unresolved debt
- **WHEN** unresolved attention debt exists and the runtime receives a new ingress event, a backoff expiry, or another explicit wake cause
- **THEN** the scheduler may launch a new model round for the affected context
- **THEN** the runtime records the wake cause for that round

### Requirement: Repeated no-progress or equivalent failures SHALL be contained
The runtime SHALL detect repeated no-progress outcomes and repeated equivalent failures, then suppress immediate retries once the configured retry budget is exhausted.

#### Scenario: Repeated no-progress transitions to blocked state
- **WHEN** consecutive rounds for the same unresolved attention debt produce no durable progress
- **THEN** the runtime increments the retry budget for that debt
- **THEN** once the retry budget is exhausted, the scheduler records a `blocked` or `backoff` state instead of launching another immediate round

#### Scenario: New external input resets containment for affected debt
- **WHEN** a blocked or backed-off attention debt receives new external input that changes the underlying context
- **THEN** the runtime clears the equivalent-failure retry streak for that affected debt
- **THEN** the scheduler may resume model work under a new wake cause

