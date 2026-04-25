## ADDED Requirements

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
