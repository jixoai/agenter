## ADDED Requirements

### Requirement: Attention protocol inputs SHALL be current-call transient inputs
Attention bootstrap `context` and `items` payloads SHALL be assembled for the current model call and SHALL NOT be persisted as bounded prompt-window replay messages. The provider request ledger SHALL still record those payloads exactly when they are sent.

#### Scenario: Current call receives attention protocol inputs
- **WHEN** runtime collects active attention for a model call
- **THEN** the provider request includes the current `context` payload before the current `items` payload
- **AND** the persisted `ai_call.request.messages` contains the same attention protocol payloads sent to the provider

#### Scenario: Later calls do not replay old attention protocol inputs
- **WHEN** a later model call is assembled after an earlier call consumed attention protocol inputs
- **THEN** the later call does not receive the earlier `AttentionContexts.metadata` payload from prompt-window replay
- **AND** the later call does not receive the earlier `Attention Items` payload from prompt-window replay

### Requirement: Focused item injection SHALL use newly committed deltas only
The attention `items` payload SHALL directly inject item detail for newly committed focused attention deltas selected at the current collection boundary. It SHALL NOT use historical cursor catch-up to resend old commits when no model-seen cursor is available.

#### Scenario: Focused new commit is injected
- **WHEN** a focused AttentionContext receives one or more newly committed AttentionItems for the current collection boundary
- **THEN** runtime serializes those newly committed item deltas into the current `items` payload
- **AND** the model can handle the active notification without first querying the full context history

#### Scenario: Historical commits are not selected by cursor fallback
- **WHEN** a focused AttentionContext already has historical commits but no new commit delta for the current collection boundary
- **THEN** runtime may include the context's aggregate score in `AttentionContexts.metadata`
- **AND** runtime does not serialize recent historical commits merely because a `lastSeenCommitId` cursor is missing

### Requirement: AttentionContext SHALL be boundary-injected while AttentionItems SHALL be in-flight injected
The runtime SHALL use `AttentionContext` payloads to re-establish model-visible context projection at hard boundaries such as prompt compaction and cold restart. The runtime SHALL use `AttentionItems` payloads only for item detail committed during the current in-flight boundary.

#### Scenario: Compact boundary refreshes context projection without item replay
- **WHEN** prompt-window compaction rebuilds the model's bounded memory while active attention still exists
- **THEN** the next attention round may include fresh `AttentionContexts.metadata`
- **AND** it does not serialize historical `AttentionItems` unless new commits happen during that boundary

#### Scenario: Restart boundary refreshes context projection without item replay
- **WHEN** a session cold starts from persisted AttentionSystem facts
- **THEN** runtime compares/rebuilds the session-local AttentionContext projection and may inject updated context metadata/scores
- **AND** runtime does not serialize historical item detail as a new `items` notification
