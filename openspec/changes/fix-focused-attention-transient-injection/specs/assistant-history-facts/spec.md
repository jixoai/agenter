## ADDED Requirements

### Requirement: Prompt window SHALL exclude transient attention protocol payloads
The bounded prompt window SHALL retain long-lived conversation, compact, tool, and factual memory, but SHALL NOT persist attention bootstrap protocol payloads whose purpose is limited to the current model call.

#### Scenario: Attention protocol payload is not prompt memory
- **WHEN** `AgenterAI` receives model input whose source is `attention` and whose protocol kind is `context` or `items`
- **THEN** that input is eligible for the current provider request
- **AND** it is not appended to the bounded prompt window used for later replay

#### Scenario: Ordinary model messages still persist
- **WHEN** `AgenterAI` receives ordinary non-transient model input
- **THEN** that input remains part of the bounded prompt window according to existing prompt-memory rules
- **AND** later calls can replay it until compaction or pruning removes it

### Requirement: AI call records SHALL preserve exact provider request messages
Excluding transient attention inputs from prompt memory SHALL NOT remove them from debugging evidence. Each `ai_call` record SHALL preserve the exact request messages that were sent to the provider for that call.

#### Scenario: Request ledger includes transient attention
- **WHEN** a provider call includes transient attention `context` or `items` input
- **THEN** `ai_call.request.messages` includes those transient inputs in provider order
- **AND** prompt-window state inspection can still distinguish that those inputs were not retained for future replay
