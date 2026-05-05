## MODIFIED Requirements

### Requirement: Runtime SHALL treat attention as the primary execution model

The runtime SHALL host a standalone LoopBus kernel that normalizes adapter-supplied system ingress into focus-aware attention ingress records before any cycle scheduling or model work starts. Focused source activity SHALL become committed attention only after the responsible adapter or bridge emits an explicit ingress delta, non-focused source activity SHALL become push ingress, and the kernel SHALL pass only attention-centric inputs into model work without requiring chat, terminal, or task output arrays as its semantic completion contract.

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

## ADDED Requirements

### Requirement: Runtime scheduling SHALL treat bridge-approved terminal ingress as the only terminal wake source

The runtime scheduler SHALL treat terminal-originated model work as valid only when the terminal activity bridge emits an explicit ingress delta or actionable wake reason. Raw terminal physical change, dirty state, or commit-cursor motion alone SHALL NOT be sufficient scheduler truth.

#### Scenario: Dirty terminal without ingress delta stays scheduler-quiet
- **WHEN** a terminal changes physically but the bridge produces no ingress delta
- **THEN** the scheduler does not wake a model round solely because that terminal became dirty
- **AND** the runtime keeps terminal truth available for later explicit inspection

#### Scenario: Actionable bridge wake starts terminal-originated work
- **WHEN** the terminal activity bridge emits an actionable wake reason with ingress delta
- **THEN** the scheduler may wake for terminal-originated work
- **AND** the resulting cycle can explain which terminal actionability reason justified the wake
