## ADDED Requirements

### Requirement: Session DB SHALL act as the objective AI-call historian
The session durable store SHALL record objective facts around AI calls, including grouped message parts, `ai_call` lifecycle rows, attention dispatches, and attention receipts. This historian role SHALL support reconstruction and inspection, but it SHALL NOT make session-system the owner of room, terminal, workspace, or attention business truth.

#### Scenario: Historian facts reconstruct inspection without owning source truth
- **WHEN** runtime inspection reads a stopped or cold session
- **THEN** session-system provides AI-call-adjacent ledger facts for reconstruction
- **AND** room history still comes from message-system, terminal truth still comes from terminal-system, and cognitive state still comes from attention-system

#### Scenario: Dispatch and receipt rows remain AI-call-adjacent facts
- **WHEN** a model attempt is dispatched, accepted, failed, aborted, or completed
- **THEN** session-system may persist the dispatch and receipt rows as objective AI-call history
- **AND** those rows do not rewrite the originating attention commit or the source-system durable truth
