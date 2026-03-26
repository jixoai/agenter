## ADDED Requirements

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
