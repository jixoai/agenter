## MODIFIED Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL normalize message, terminal, task, and future system activity into committed attention items before any cycle scheduling or model work starts. The kernel SHALL pass only attention-centric inputs into model work and SHALL NOT require chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Focused source activity becomes committed attention
- **WHEN** a message source, focused terminal source, or future system source invalidates runtime work
- **THEN** the runtime resolves that source into one or more context-bound attention drafts
- **THEN** the runtime commits those items before evaluating whether a cycle should start

#### Scenario: No committed attention delta means no cycle work
- **WHEN** all invalidated sources resolve without creating or changing any attention item
- **THEN** the runtime does not schedule a new model pass from that source activity alone
- **THEN** it does not fabricate a flattened fallback input to force a cycle

#### Scenario: Attention progress does not require legacy output arrays
- **WHEN** a model pass reduces attention debt through committed attention mutations or provider side-effects
- **THEN** the kernel treats that round as valid progress even if the processor returns no `toUser`, `terminal`, or `tools` payloads
- **THEN** projection layers derive user-visible updates from persisted facts instead of core response outputs
