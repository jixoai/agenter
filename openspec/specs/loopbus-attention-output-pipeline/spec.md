# loopbus-attention-output-pipeline Specification

## Purpose
TBD - created by archiving change loopbus-attention-io-pipeline. Update Purpose after archive.
## Requirements
### Requirement: LoopBus SHALL keep attention commits separate from visible system mutations
Committed attention items SHALL remain cognitive facts. Visible effects in other systems SHALL occur through explicit system mutations or delivery dispatch/receipt facts instead of hidden output adapters or processor-returned output arrays. LoopBus SHALL treat committed attention, compact-window rewrites, and adapter side-effects as inspectable outcomes of a cycle.

#### Scenario: Message output uses explicit mutation
- **WHEN** a model needs to create, correct, or withdraw a visible room row
- **THEN** it uses explicit message-system mutations such as `message send`, `message edit`, or `message recall`
- **THEN** session-runtime does not need hidden attention-output routing branches for that item

#### Scenario: Processor does not return legacy output arrays
- **WHEN** a processor round settles work through committed attention or compact-window state changes
- **THEN** LoopBus does not require `toUser`, `terminal`, or `tools` arrays from the processor response
- **THEN** the cycle still completes from persisted facts and adapter side-effects

### Requirement: LoopBus lifecycle SHALL propagate abort signals
Dispatch, receipt, model-call, tool-execution, and plugin lifecycle work SHALL receive the active cycle abort signal when that work can outlive the initiating call stack.

#### Scenario: Stop aborts a pending model call
- **WHEN** the session is stopped while a model call is active
- **THEN** the lifecycle abort signal is triggered
- **THEN** downstream adapters and hooks stop work promptly
