## MODIFIED Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL host a standalone LoopBus kernel that normalizes adapter-supplied system ingress into focus-aware attention ingress records before any cycle scheduling or model work starts. Focused source activity SHALL become committed attention, non-focused source activity SHALL become push ingress, and the kernel SHALL pass only attention-centric inputs into model work without requiring chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Session host boots the standalone kernel and its adapters
- **WHEN** a session runtime starts
- **THEN** it creates one standalone LoopBus kernel and mounts the configured system adapters around it
- **AND** the runtime host remains responsible for persistence and publication instead of re-implementing kernel law inline

#### Scenario: Focused source activity becomes committed attention through an adapter
- **WHEN** a message source, focused terminal source, workspace source, or future system source invalidates runtime work for a focused attention context
- **THEN** the responsible adapter resolves that source into one or more neutral ingress envelopes
- **AND** the kernel turns those envelopes into context-bound attention commits before evaluating whether a cycle should start

#### Scenario: Focused terminal observations remain history unless explicitly actionable
- **WHEN** a focused terminal source emits snapshot or diff observations for model reasoning
- **THEN** the terminal adapter may publish those observations as context-bound attention history
- **AND** those commits do not automatically remain unresolved debt unless the terminal event is explicitly scored as actionable

#### Scenario: Background source activity becomes push ingress through an adapter
- **WHEN** non-focused message, terminal, or workspace activity invalidates runtime work
- **THEN** the responsible adapter records that source activity as attention push ingress in the target context
- **AND** shell notification projections are derived from that push ingress
- **AND** the source system is not required to claim focus first

#### Scenario: No attention ingress delta means no cycle work
- **WHEN** all invalidated adapter inputs resolve without creating or changing any attention ingress
- **THEN** the kernel does not schedule a new model pass from that source activity alone
- **AND** it does not fabricate a flattened fallback input to force a cycle

#### Scenario: Attention progress does not require legacy output arrays
- **WHEN** a model pass reduces attention debt through committed attention mutations or provider side-effects
- **THEN** the kernel treats that round as valid progress even if the processor returns no `toUser`, `terminal`, or `tools` payloads
- **AND** projection layers derive user-visible updates from persisted facts instead of core response outputs
