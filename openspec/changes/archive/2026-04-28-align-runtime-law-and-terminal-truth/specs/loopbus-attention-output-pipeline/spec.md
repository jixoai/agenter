## REMOVED Requirements

### Requirement: LoopBus SHALL dispatch committed attention through egress adapters
**Reason**: Current runtime law separates cognitive attention commits from visible system mutations and AI delivery receipts. Keeping an egress-adapter requirement would reintroduce the old ambiguity where an attention commit can look like a hidden room-output command.

**Migration**: Use neutral system-kernel adapters for ingress, use dispatch/receipt records for AI delivery attempts, and use explicit system tools such as `message send`, `message edit`, and `message recall` for room-visible mutations.

## MODIFIED Requirements

### Requirement: LoopBus lifecycle SHALL propagate abort signals
Dispatch, receipt, model-call, tool-execution, and plugin lifecycle work SHALL receive the active cycle abort signal when that work can outlive the initiating call stack.

#### Scenario: Stop aborts a pending model call
- **WHEN** the session is stopped while a model call is active
- **THEN** the lifecycle abort signal is triggered
- **THEN** downstream adapters and hooks stop work promptly
