## MODIFIED Requirements

### Requirement: Heartbeat SHALL render one continuous AI-call runtime stream
The `Heartbeat` tab SHALL render the session heartbeat as one continuous runtime message surface backed by the session AI-call ledger. It SHALL present role-user and role-assistant messages as the dominant stream, SHALL include compact-boundary separator rows when prompt-window compaction restarts the bounded context, and SHALL treat virtualization as a list concern separate from message rendering primitives.

#### Scenario: Heartbeat shows compact boundaries between message spans
- **GIVEN** a session performs a manual or automatic compact cycle between two normal model replies
- **WHEN** the operator opens `Heartbeat`
- **THEN** the runtime stream shows a dedicated compact separator row at the compaction boundary
- **AND** the separator is rendered as a boundary marker rather than a normal user or assistant message bubble
