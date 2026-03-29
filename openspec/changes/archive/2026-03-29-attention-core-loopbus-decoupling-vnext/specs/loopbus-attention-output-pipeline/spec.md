## MODIFIED Requirements

### Requirement: LoopBus SHALL dispatch committed attention through egress adapters
Committed attention items SHALL be offered to registered egress adapters instead of being routed through ad-hoc runtime code or processor-returned output arrays. LoopBus SHALL treat committed attention, compact-window rewrites, and adapter side-effects as the authoritative outcomes of a cycle.

#### Scenario: Message egress consumes a reply item
- **WHEN** a committed attention item declares a message-system reply target
- **THEN** the message egress adapter dispatches the reply
- **THEN** session-runtime does not need direct message-routing branches for that item

#### Scenario: Processor does not return legacy output arrays
- **WHEN** a processor round settles work through committed attention or compact-window state changes
- **THEN** LoopBus does not require `toUser`, `terminal`, or `tools` arrays from the processor response
- **THEN** the cycle still completes from persisted facts and adapter side-effects
