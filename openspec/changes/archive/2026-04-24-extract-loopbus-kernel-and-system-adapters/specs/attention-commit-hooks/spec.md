## MODIFIED Requirements

### Requirement: Attention lifecycle hooks SHALL return observable results
Every successful attention lifecycle transition that exposes hooks to the model or inspection surfaces MUST return the results of the hooks that ran for that lifecycle stage. The runtime SHALL distinguish commit, dispatch, and receipt stages explicitly, and `attentionCommitted` results MUST NOT be reused as AI delivery truth.

#### Scenario: Commit hook results are returned to the model
- **WHEN** an attention commit triggers one or more commit-stage hooks
- **THEN** the `attention_commit` tool result includes each hook outcome with system id, hook id, status, and any failure details
- **AND** those outcomes describe commit-stage side effects only

#### Scenario: Dispatch hook results are observable
- **WHEN** the kernel selects a commit for model delivery and dispatch-stage hooks run
- **THEN** runtime inspection surfaces can observe the dispatch hook outcomes for that attempt
- **AND** operators can distinguish dispatch-stage bridge work from the earlier commit-stage result

#### Scenario: Receipt hook results are observable with typed delivery status
- **WHEN** the kernel records a receipt-stage outcome such as `accepted`, `errored`, `aborted`, or `completed`
- **THEN** receipt-stage hook outcomes remain observable together with that typed delivery status
- **AND** consumers do not need to infer which lifecycle stage produced the hook result

#### Scenario: Commit hook success does not imply AI acceptance
- **WHEN** commit-stage hooks all return successful outcomes
- **THEN** the runtime does not mark the related attempt as accepted until receipt-stage truth exists
- **AND** inspection surfaces keep hook success separate from AI delivery success
