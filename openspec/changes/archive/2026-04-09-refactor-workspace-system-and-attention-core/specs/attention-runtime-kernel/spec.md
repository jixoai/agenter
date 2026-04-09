## MODIFIED Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL normalize message, terminal, task, workspace, and future system activity into focus-aware attention ingress records before any cycle scheduling or model work starts. Focused source activity SHALL become committed attention, non-focused source activity SHALL become push ingress, and the kernel SHALL pass only attention-centric inputs into model work without requiring chat, terminal, or task output arrays as its semantic completion contract.

#### Scenario: Focused source activity becomes committed attention
- **WHEN** a message source, focused terminal source, workspace source, or future system source invalidates runtime work for a focused attention context
- **THEN** the runtime resolves that source into one or more context-bound attention commits
- **AND** the runtime commits those items before evaluating whether a cycle should start

#### Scenario: Background source activity becomes push ingress
- **WHEN** non-focused message, terminal, or workspace activity invalidates runtime work
- **THEN** the runtime records that source activity as attention push ingress in the target context
- **AND** shell notification projections are derived from that push ingress
- **AND** the source system is not required to claim focus first

#### Scenario: No attention ingress delta means no cycle work
- **WHEN** all invalidated sources resolve without creating or changing any attention ingress
- **THEN** the runtime does not schedule a new model pass from that source activity alone
- **AND** it does not fabricate a flattened fallback input to force a cycle
