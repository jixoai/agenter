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

### Requirement: Stop and abort SHALL cancel in-flight runtime work
The session lifecycle SHALL cancel in-flight model and tool work through explicit runtime cancellation semantics when a session is stopped or aborted.

#### Scenario: Stop cancels in-flight work but preserves resumable runtime state
- **WHEN** a caller invokes `session.stop` while the runtime has an active model call or tool execution
- **THEN** the runtime aborts the in-flight work through its shared cancellation signal
- **THEN** the session remains resumable with preserved runtime resources after the cancellation completes

#### Scenario: Abort cancels in-flight work before teardown
- **WHEN** a caller invokes `session.abort` while the runtime has active work in flight
- **THEN** the runtime aborts the in-flight work through its shared cancellation signal
- **THEN** resource teardown happens only after the cancellation outcome has been recorded

