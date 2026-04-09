## ADDED Requirements

### Requirement: Attention SHALL distinguish focused commits from background pushes
The attention system SHALL record external ingress as `commit` when it targets a focused context and as `push` when it targets a non-focused context.

#### Scenario: Focused context ingress becomes a commit
- **WHEN** external source activity targets an AttentionContext whose focus state is `focused`
- **THEN** the runtime records that ingress as an attention `commit`
- **AND** the resulting work participates in the normal focused attention flow

#### Scenario: Background context ingress becomes a push
- **WHEN** external source activity targets an AttentionContext whose focus state is `background` or `muted`
- **THEN** the runtime records that ingress as an attention `push`
- **AND** the source adapter does not need to promote the context to focused first

### Requirement: Push ingress SHALL remain durable attention state
Attention `push` ingress SHALL be stored as attention history within the target context rather than as a separate notification ledger.

#### Scenario: Push ingress remains queryable after projection
- **WHEN** a background notification is recorded as a push
- **THEN** the push remains queryable through attention history and attention projections
- **AND** shell badge or preview rendering does not delete the underlying push record

### Requirement: Notification chrome SHALL be derived from push-aware attention projection
The system SHALL derive unread badges, preview cards, and related notification surfaces from attention contexts and their unconsumed push ingress.

#### Scenario: Unconsumed push creates unread shell preview
- **WHEN** an AvatarRuntime receives a push for a non-focused context
- **THEN** the runtime publishes a derived unread notification projection for shell surfaces
- **AND** the projection references the underlying attention context instead of creating a second durable notification row

#### Scenario: Restored focus consumes the push projection without erasing history
- **WHEN** the Avatar focuses the target context and consumes the notification
- **THEN** the shell unread projection is cleared for that push
- **AND** the underlying attention history remains available for inspection

### Requirement: Push ingress SHALL support quick-action metadata
Push ingress SHALL support source-provided quick-action metadata so the UI can expose reply or defer affordances without forcing a full context switch.

#### Scenario: Source adapter attaches quick-reply metadata to a push
- **WHEN** a message or other source publishes a push with quick-action metadata
- **THEN** the attention projection includes that metadata for UI consumption
- **AND** the runtime can execute the quick action without requiring the user to navigate away from the current focused context first
