## Purpose

Define the attention-derived unread notification projection and its shell-facing entry points.

## Requirements

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
