## MODIFIED Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model
The runtime SHALL host a standalone LoopBus kernel that consumes durable attention truth as its primary execution model. Adapters and external systems MAY create attention ingress through the independent attention control plane before runtime startup; when runtime is live, it SHALL recover, schedule, and advance that attention truth instead of acting as the sole ingress writer.

#### Scenario: Session host boots the standalone kernel and recovers existing attention truth
- **WHEN** a session runtime starts
- **THEN** it creates one standalone LoopBus kernel and mounts the configured system adapters
- **AND** it restores current attention truth that may already contain commits written while runtime was offline

#### Scenario: Focused source activity becomes committed attention through an adapter
- **WHEN** a message source, focused terminal source, workspace source, or future system source invalidates runtime work for a focused attention context
- **THEN** the responsible adapter resolves that source into one or more neutral ingress envelopes
- **AND** the kernel turns those envelopes into context-bound attention commits before evaluating whether a cycle should start

#### Scenario: Focused terminal observations remain history unless explicitly actionable
- **WHEN** a focused terminal source emits snapshot or diff observations for model reasoning
- **THEN** the terminal adapter may publish those observations as context-bound attention history
- **AND** those commits do not automatically remain unresolved debt unless the terminal event is explicitly scored as actionable

#### Scenario: Focused passive terminal observation does not force a cycle
- **WHEN** the terminal activity bridge classifies a focused terminal change as passive observation and produces no ingress delta
- **THEN** the kernel does not schedule a new model pass from that terminal change alone
- **AND** passive terminal history remains inspectable without becoming immediate cycle work

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

#### Scenario: Tool-result boundaries commit interleaved inputs through one API
- **WHEN** a provider tool-result boundary creates an opportunity to include newly arrived user, message, terminal, task, or plugin facts in the same model loop
- **THEN** hooks receive an explicit context with a commit API such as `ctx.commitAttentionItems()`
- **AND** hooks do not return model messages or attention payloads as a side channel
- **AND** the commit API drains source adapters, commits AttentionSystem items, updates source consume/read-ack truth, records trace facts, and stages the model-facing projection as one boundary
- **AND** the synchronous provider loop strategy only consumes the staged projection for the next continuation request

#### Scenario: Offline-written attention becomes runtime work after startup
- **WHEN** external systems committed unresolved attention while runtime was offline
- **THEN** the next runtime startup recovers that durable attention as active work
- **AND** the runtime can schedule it without requiring the original external system to replay ingress
