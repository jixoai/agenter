# attention-context-state Specification

## Purpose
TBD - created by archiving change attention-context-commit-kernel-vnext. Update Purpose after archive.

## Requirements

### Requirement: Context owns mutable attention state
The system MUST model each attention context as mutable state with a stable `contextId`, current content, current score map, `headCommitId`, and durable focus state.

#### Scenario: Context content is replaced by update commit
- **WHEN** an `attention_commit` with `change.type = "update"` is applied
- **THEN** the context content becomes the provided value
- **AND** the context head advances to the new commit
- **AND** the context score map is updated using the commit score patch.

#### Scenario: Context focus state changes without rewriting content
- **WHEN** the system changes an attention context from `focused` to `background`, `muted`, or back again
- **THEN** the context preserves its current content and score map
- **AND** the updated context state records the new focus state as durable attention state
- **AND** later ingress routing uses that focus state as the canonical focus signal

### Requirement: Commit history is immutable
The system MUST preserve every attention commit as an immutable history entry linked to its context.

#### Scenario: Commit history remains queryable after head advances
- **GIVEN** a context with multiple commits
- **WHEN** the head advances to a newer commit
- **THEN** older commits remain available in commit history
- **AND** the context head points only to the latest commit.

### Requirement: Context focus state SHALL be the single source of truth for attention engagement
The attention system MUST treat context focus state as the canonical engagement signal and SHALL project that state outward to source adapters instead of importing source-local focus as the durable truth.

#### Scenario: Source adapters consume focus from attention
- **WHEN** a source adapter needs to know whether an attention context is engaged
- **THEN** it reads the current focus state from the attention context or its derived hook output
- **AND** it does not become the durable owner of that focus state itself

### Requirement: Focus state SHALL define whether push debt remains active
The attention system SHALL interpret unresolved push scores through the context focus state. `focused` and `background` pushes remain active until they are consumed or resolved, while ordinary `muted` pushes stay dormant unless they carry notification-class semantics.

#### Scenario: Background push remains active without focus promotion
- **WHEN** a context in `background` receives a push with unresolved scores
- **THEN** the context still reports active debt
- **AND** the push remains separately queryable for notification projection until it is consumed

#### Scenario: Muted push stays dormant by default
- **WHEN** a context in `muted` receives a normal push with unresolved scores
- **THEN** the context does not report active debt from that push alone
- **AND** the push still remains in durable history for later inspection
