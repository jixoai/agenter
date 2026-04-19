# attention-notification-push Specification

## Purpose
Define durable attention push ingress and its notification projection contract.
## Requirements
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

### Requirement: Background pushes SHALL stay actionable while muted pushes stay dormant by default
Unconsumed push ingress with unresolved score SHALL remain active for `background` contexts, while ordinary `muted` pushes SHALL remain durable but non-wakeable until focus changes or another explicit override arrives.

#### Scenario: Background push keeps LoopBus eligible to wake
- **WHEN** a `background` context receives an unconsumed push with unresolved score
- **THEN** the attention system still reports that context as active debt
- **AND** scheduling may wake LoopBus for that background work

#### Scenario: Muted push does not wake by itself
- **WHEN** a `muted` context receives an ordinary unconsumed push with unresolved score
- **THEN** the push is stored durably
- **AND** the context does not become wakeable from that push alone

### Requirement: Push ingress SHALL remain durable attention state
Attention `push` ingress SHALL be stored as attention history within the target context rather than as a separate notification ledger.

#### Scenario: Push ingress remains queryable after projection
- **WHEN** a background notification is recorded as a push
- **THEN** the push remains queryable through attention history and attention projections
- **AND** shell badge or preview rendering does not delete the underlying push record

### Requirement: Notification chrome SHALL be derived from push-aware attention projection
The system SHALL derive unread badges, preview cards, and related notification surfaces from attention contexts and their unconsumed push ingress. Shared notification items SHALL expose the underlying source as protocol-native `src` plus registry-derived bucket identity, and SHALL NOT synthesize message-specific or terminal-specific fields into the shared contract.

#### Scenario: Unconsumed push creates unread shell preview
- **WHEN** an AvatarRuntime receives a push for a non-focused context
- **THEN** the runtime publishes a derived unread notification projection for shell surfaces
- **AND** each unread item carries protocol-native `src` plus registry-derived bucket identity
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

### Requirement: Notification-class push SHALL override muted default
Push ingress MAY carry notification-class semantics for urgent interruption. Notification-class pushes SHALL remain active even when the target context is `muted`.

#### Scenario: Notification push forces wake from a muted context
- **WHEN** a `muted` context receives a push marked as notification-class with unresolved score
- **THEN** the attention system reports that context as active debt
- **AND** the runtime may wake LoopBus without changing the durable focus state

### Requirement: Notification consumption SHALL follow namespace-owned source cursor rules
The notification system SHALL consume unread pushes through protocol-native source cursors. When a caller provides an `upToSrc`, the system SHALL use the owning namespace's bucket and comparison rules to determine which unread pushes are cleared.

#### Scenario: Room visibility consumes message pushes through a room source cursor
- **WHEN** a room surface reports that the latest visible durable source is `msg:13/155`
- **THEN** the notification layer clears unread pushes from the same room bucket up to that source according to the `msg` namespace comparison rule
- **THEN** shared runtime code does not compare those pushes through a message-specific numeric helper

