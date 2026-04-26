## MODIFIED Requirements

### Requirement: Attention trace publication SHALL expose causal lookup refs
Trace consumers SHALL be able to locate trace history from attention refs, cycle-frame refs, model-call refs, delivery refs, and explicit system-mutation refs.

#### Scenario: Trace lookup follows attention and delivery refs
- **WHEN** a runtime inspector opens a trace from an attention commit
- **THEN** the inspector can locate linked cycle, model-call, dispatch, receipt, and explicit system-mutation facts
- **AND** it does not require a legacy output-routing ref to reconstruct the causal chain
