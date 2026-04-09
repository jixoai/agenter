## MODIFIED Requirements

### Requirement: Sessions SHALL distinguish pause from abort
The session lifecycle SHALL expose a recoverable `session.stop` operation and a destructive `session.abort` operation as separate intents, but both operations SHALL remove live runtime ownership from the kernel once they complete.

#### Scenario: Stop detaches the runtime and preserves durable recovery state
- **WHEN** a caller invokes `session.stop` for a running session
- **THEN** the session status becomes `stopped`
- **THEN** the current LoopBus or model work is canceled
- **THEN** the live runtime is detached from kernel ownership
- **THEN** a later `session.start` rehydrates from persisted session state instead of resuming the previous in-memory runtime

#### Scenario: Abort tears down the runtime
- **WHEN** a caller invokes `session.abort` for a running or stopped session
- **THEN** the runtime is disposed and detached from kernel ownership
- **THEN** terminal resources are destroyed
- **THEN** later `session.start` requires creating a new runtime instance from persisted session state

### Requirement: Session start SHALL resume paused runtimes in place
The session start operation SHALL recreate stopped sessions from persisted state when no live runtime is still owned by the kernel.

#### Scenario: Start after stop rehydrates from persisted state
- **WHEN** a caller invokes `session.start` after `session.stop` has detached the runtime
- **THEN** the kernel creates a new runtime instance
- **THEN** that runtime restores durable session facts such as attention state from disk
- **THEN** the session returns to `running`
