## Purpose

Define the frontend-facing publication contract for LoopBus runtime state.
## Requirements
### Requirement: LoopBus runtime SHALL publish stable frontend-facing state
Runtime inspection state SHALL be published through explicit attention-native frame and trace contracts so frontend consumers can inspect scheduling behavior without depending on backend-private LoopBus assembly details.

#### Scenario: Runtime store ingests attention-native inspection state
- **WHEN** the backend publishes runtime frame and trace updates
- **THEN** client-sdk ingests the related attention refs, cycle-frame refs, trace spans, and terminal outcomes through explicit contracts
- **THEN** frontend selectors do not need to reconstruct runtime state from ad-hoc private fields

#### Scenario: Devtools renders published trace and frame state
- **WHEN** WebUI Devtools renders runtime execution details
- **THEN** it uses the published attention-native inspection contract
- **THEN** the surface does not require backend-private scheduler knowledge to remain correct

### Requirement: LoopBus runtime SHALL publish delivery lifecycle facts explicitly
Runtime publication SHALL expose dispatch and receipt facts as first-class runtime events and inspection payloads so frontend consumers can observe delivery truth without reconstructing it from unrelated runtime slices.

#### Scenario: Runtime publication emits dispatch events
- **WHEN** the kernel creates a new dispatch attempt for a hydrated session
- **THEN** runtime publication emits a dispatch event carrying the dispatch identity, related commit reference, cycle identity, and current delivery summary
- **AND** consumers do not need to wait for the next grouped Heartbeat refresh to know that delivery entered `dispatching`

#### Scenario: Runtime publication emits receipt events
- **WHEN** the kernel records an `accepted`, `errored`, `aborted`, or `completed` receipt for a hydrated session
- **THEN** runtime publication emits a receipt event carrying the receipt fact and updated delivery summary
- **AND** consumers can update visible delivery state without inferring it from trace or `ai_call` state

#### Scenario: Runtime publication emits full delivery projection refreshes
- **WHEN** dispatch, receipt, watch, or explicit effect truth changes for a hydrated session
- **THEN** runtime publication also emits one `runtime.attentionDelivery` snapshot-style payload containing projections, dispatches, receipts, watches, and explicit effects
- **AND** consumers can fully replace their delivery ledger slice from that event without merging scheduler or attention facts into the same payload

### Requirement: Grouped runtime inspection SHALL keep delivery truth independent from Heartbeat part grouping
Grouped runtime inspection surfaces MAY continue to group Heartbeat parts for readability, but SHALL keep attention delivery truth as its own explicit projection instead of rebuilding it from grouped request or response rows.

#### Scenario: Grouped Heartbeat shows queued work before any assistant stream exists
- **WHEN** a commit has entered `pending` or `dispatching` and no assistant response part exists yet
- **THEN** grouped runtime inspection still exposes that delivery state explicitly
- **AND** the operator does not need a synthetic assistant/request row to understand that AI has not accepted the work yet

#### Scenario: Delivery projection survives grouped Heartbeat refresh
- **WHEN** grouped Heartbeat data refreshes after a runtime invalidation
- **THEN** delivery truth remains attached to the related commit or attempt summary
- **AND** grouped request/response rows do not overwrite or collapse dispatch/receipt history
