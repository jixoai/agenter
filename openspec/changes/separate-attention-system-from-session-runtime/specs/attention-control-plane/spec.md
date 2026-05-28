## ADDED Requirements

### Requirement: Attention system SHALL expose an independent durable ingress control plane
The attention system SHALL provide a durable ingress control plane that can create or update attention truth without requiring a live `SessionRuntime` instance. External systems MUST be able to commit attention work through this control plane using explicit context identity, commit payload, and ingress metadata.

#### Scenario: Message follow-up writes attention while runtime is offline
- **WHEN** a durable message follow-up task becomes due while the owner session runtime is not started
- **THEN** message-system commits the reminder through the attention control plane
- **AND** the resulting attention commit is durably persisted without waiting for runtime startup

#### Scenario: Control plane persists source-authored ingress directly
- **WHEN** an external system submits a valid attention ingress envelope to the control plane
- **THEN** the control plane records the resulting attention commit and context state durably
- **AND** the write does not require a runtime-local callback to finish persistence

### Requirement: Attention control plane SHALL preserve context law outside runtime
The independent control plane SHALL apply the same attention context mutation, score, and focus-state laws as runtime-originated commits. Moving the write path out of runtime MUST NOT create a second incompatible attention semantics.

#### Scenario: External ingress preserves Avatar-authored context summary
- **GIVEN** a room-backed attention context already contains an Avatar-authored summary
- **WHEN** a message-system follow-up reminder is committed through the attention control plane
- **THEN** the durable commit history records the reminder detail
- **AND** the current context summary remains unchanged unless the ingress explicitly requests context mutation

#### Scenario: External ingress advances durable unresolved score state
- **WHEN** an external ingress commit carries unresolved scores
- **THEN** the control plane updates the context score projection and head commit durably
- **AND** later runtime recovery sees the same unresolved attention state

### Requirement: Attention control plane SHALL support cold-start recovery consumers
The attention system SHALL allow runtimes and inspection surfaces to recover current active attention truth after external ingress has been written while they were offline.

#### Scenario: Runtime cold start sees offline-written attention
- **GIVEN** an external system wrote one or more attention commits while a session runtime was offline
- **WHEN** that session runtime cold starts later
- **THEN** it restores the active contexts and unresolved work from attention durability
- **AND** it can continue scheduling or consuming that work without replaying the original external event

#### Scenario: Inspection can query offline-written attention before runtime start
- **WHEN** durable attention commits exist before a session runtime starts
- **THEN** attention inspection surfaces can query those commits directly from attention durability
- **AND** the data does not require runtime bootstrapping just to become visible
