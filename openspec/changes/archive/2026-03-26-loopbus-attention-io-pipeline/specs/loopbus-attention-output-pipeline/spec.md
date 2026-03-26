Define how committed attention items are dispatched to external systems through LoopBus.

## ADDED Requirements

### Requirement: LoopBus SHALL dispatch committed attention through egress adapters
Committed attention items SHALL be offered to registered egress adapters instead of being routed through ad-hoc runtime code.

#### Scenario: Message egress consumes a reply item
- **WHEN** a committed attention item declares a message-system reply target
- **THEN** the message egress adapter dispatches the reply
- **THEN** session-runtime does not need direct message-routing branches for that item

### Requirement: LoopBus lifecycle SHALL propagate abort signals
Dispatch and model-call lifecycle hooks SHALL receive the active cycle abort signal.

#### Scenario: Stop aborts a pending model call
- **WHEN** the session is stopped while a model call is active
- **THEN** the lifecycle abort signal is triggered
- **THEN** downstream adapters and hooks stop work promptly
