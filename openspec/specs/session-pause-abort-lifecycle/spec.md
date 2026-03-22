# session-pause-abort-lifecycle Specification

## Purpose
TBD - created by archiving change split-session-stop-abort-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Sessions SHALL distinguish pause from abort
The session lifecycle SHALL expose a non-destructive pause operation and a destructive abort operation as separate semantics.

#### Scenario: Stop pauses LoopBus but preserves runtime resources
- **WHEN** a caller invokes `session.stop` for a running session
- **THEN** the session status becomes `paused`
- **THEN** the current LoopBus/model work is canceled
- **THEN** the runtime, terminals, and inspection history remain available for resume and inspection

#### Scenario: Abort tears down the runtime
- **WHEN** a caller invokes `session.abort` for a running or paused session
- **THEN** the runtime is disposed and detached from kernel ownership
- **THEN** terminal resources are destroyed
- **THEN** later resume requires creating a new runtime instance

### Requirement: Session start SHALL resume paused runtimes in place
The session start operation SHALL reuse an existing paused runtime instead of recreating it.

#### Scenario: Resume a paused session
- **WHEN** a caller invokes `session.start` for a paused session
- **THEN** the existing runtime resumes LoopBus scheduling
- **THEN** session-owned terminals and inspection data continue from the preserved runtime state

