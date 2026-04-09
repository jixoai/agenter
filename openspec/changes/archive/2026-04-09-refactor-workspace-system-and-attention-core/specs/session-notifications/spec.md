## REMOVED Requirements

### Requirement: Session notifications SHALL project unread assistant replies
**Reason**: Standalone session notification projection is replaced by attention-derived push projection.
**Migration**: Publish background notification state through attention push ingress and consume shell unread/badge surfaces from attention-derived projections instead of `SessionNotificationRegistry`.

### Requirement: Session notifications SHALL be consumed by visible chat
**Reason**: Consumption is now driven by attention focus and projection hooks rather than by direct mutation of a standalone session notification store.
**Migration**: Report focus/visibility changes into attention hooks and let the attention-derived projection consume the matching push state.

### Requirement: Session notifications SHALL be ephemeral runtime state
**Reason**: Notification state now lives as durable push ingress inside attention contexts, while shell badges/previews remain derived runtime projections.
**Migration**: Persist push ingress as attention history and treat shell notification state as a projection only.

### Requirement: Session notifications SHALL surface through running-session navigation entry points
**Reason**: Notification discoverability now belongs to the shared shell and Avatar runtime navigation surfaces rather than to a session-local registry.
**Migration**: Read unread state from shared attention-derived notification projections when rendering shell navigation.

### Requirement: Session notifications SHALL remain stable across real-session history hydration
**Reason**: Hydration stability is now part of attention projection consumption rules instead of a separate session notification store.
**Migration**: Keep focus/visibility consumption rules in the attention projection layer so history hydration cannot clear unread state early.

## ADDED Requirements

### Requirement: Attention-derived notifications SHALL project unread background pushes
The app-server SHALL derive unread notification surfaces from attention push ingress that targets non-focused contexts.

#### Scenario: Background push creates unread projection
- **WHEN** a runtime records a push for a non-focused attention context
- **THEN** the notification projection records an unread entry derived from that push
- **AND** the unread count for the owning runtime or shell surface increases accordingly

#### Scenario: Focused ingress does not create unread projection
- **WHEN** source activity targets a focused attention context and is recorded as a commit
- **THEN** the notification projection does not create a background unread entry for that ingress

### Requirement: Attention-derived notifications SHALL be consumed by restored focus or explicit quick action
The system SHALL clear unread notification projections when the corresponding attention push is consumed through focus restoration or an explicit quick action, without deleting the underlying attention history.

#### Scenario: Restoring focus clears unread projection
- **WHEN** the user or runtime restores focus to the pushed context and consumes the unread notification
- **THEN** the shell unread projection for that push is cleared
- **AND** the underlying attention history remains queryable

#### Scenario: Quick action clears projection without full navigation
- **WHEN** the user executes a quick reply or defer action directly from the notification surface
- **THEN** the unread projection is updated as consumed for that push
- **AND** the system is not required to open the full source surface first
