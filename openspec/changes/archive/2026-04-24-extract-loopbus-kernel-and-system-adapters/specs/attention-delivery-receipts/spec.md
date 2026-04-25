## ADDED Requirements

### Requirement: Kernel SHALL persist delivery attempts separately from attention commits
The runtime kernel SHALL persist each AI delivery attempt as a dispatch record separate from the originating `AttentionCommit`, and SHALL persist each later stream outcome as one or more receipt records linked to that dispatch. A commit SHALL remain the obligation truth even when no delivery attempt exists yet.

#### Scenario: Dispatch exists before the session ledger assigns an `ai_call` id
- **WHEN** the kernel selects an unresolved attention commit for a model round
- **THEN** it creates one dispatch record for that attempt before any acceptance receipt exists
- **AND** that dispatch record carries the logical agent-call identity even if `sessionModelCallId` is still null

#### Scenario: Session ledger binds a concrete `ai_call` id to an existing dispatch
- **WHEN** the session durable ledger later creates or discovers the concrete `ai_call` row for that logical attempt
- **THEN** the runtime binds the `sessionModelCallId` onto the existing dispatch record
- **AND** it does not create a second dispatch or rewrite the originating attention commit

### Requirement: Kernel SHALL derive acceptance from stream receipts instead of `ai_call running`
The runtime kernel SHALL treat AI ingress acceptance as a stream-boundary fact. `ai_call.status = "running"` SHALL remain observable request lifecycle state, but SHALL NOT imply that AI has accepted the attempt.

#### Scenario: First valid SSE yields acceptance
- **WHEN** a dispatch receives its first non-error provider stream event such as assistant text, thinking, or tool-call start
- **THEN** the kernel appends an `accepted` receipt for that dispatch
- **AND** delivery projection for that commit no longer remains `pending` or `dispatching`

#### Scenario: First error stream outcome yields failure without acceptance
- **WHEN** the first observable stream outcome for a dispatch is a provider error event or transport/build-stream failure
- **THEN** the kernel appends an `errored` receipt for that dispatch
- **AND** no `accepted` receipt is recorded for that attempt

#### Scenario: Missing or invalid credentials still terminate the selected attempt
- **WHEN** the runtime has already selected a commit for delivery but the provider cannot be called because credentials are missing or rejected before the first valid SSE
- **THEN** the kernel appends an `errored` receipt with transport/provider failure semantics for that attempt
- **AND** the delivery projection does not remain stuck in `dispatching`

### Requirement: Kernel SHALL preserve attempt history and derive one delivery projection from it
The runtime kernel SHALL keep receipt history for every delivery attempt, and SHALL derive the current delivery projection from the latest attempt without erasing earlier attempts.

#### Scenario: Commit without a dispatch remains pending
- **WHEN** an attention commit exists but the scheduler has not yet selected it for any model attempt
- **THEN** delivery projection for that commit is `pending`
- **AND** the delivery timeline contains no dispatch or receipt rows

#### Scenario: Dispatch without a receipt remains dispatching
- **WHEN** a dispatch exists for a commit and no receipt has been recorded yet
- **THEN** delivery projection for that commit is `dispatching`
- **AND** Heartbeat or other inspection surfaces can show that state without inferring acceptance

#### Scenario: Retry preserves both attempts while summary follows the latest attempt
- **WHEN** one commit is first dispatched and fails, and a later cycle retries the same commit
- **THEN** the delivery timeline retains both dispatch attempts and their receipts
- **AND** the summary projection for that commit reflects only the latest attempt's state

### Requirement: Runtime publication SHALL expose delivery truth directly
Runtime inspection publication SHALL expose dispatch and receipt truth as first-class delivery facts so clients do not need to infer AI progress from message read-state or `ai_call` lifecycle state.

#### Scenario: Heartbeat reads delivery truth without message-read inference
- **WHEN** Heartbeat or another runtime inspection consumer queries delivery state for a commit
- **THEN** the returned delivery state comes from dispatch and receipt facts
- **AND** it does not depend on `readActorIds`, `unreadActorIds`, or room-level read projections

#### Scenario: Clients can observe delivery changes as they happen
- **WHEN** a dispatch or receipt fact is appended for a hydrated session
- **THEN** runtime publication emits a delivery update for that session
- **AND** consumers do not need a full page reload to learn that the delivery state changed
