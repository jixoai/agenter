## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Notification consumption SHALL follow namespace-owned source cursor rules
The notification system SHALL consume unread pushes through protocol-native source cursors. When a caller provides an `upToSrc`, the system SHALL use the owning namespace's bucket and comparison rules to determine which unread pushes are cleared.

#### Scenario: Room visibility consumes message pushes through a room source cursor
- **WHEN** a room surface reports that the latest visible durable source is `msg:13/155`
- **THEN** the notification layer clears unread pushes from the same room bucket up to that source according to the `msg` namespace comparison rule
- **THEN** shared runtime code does not compare those pushes through a message-specific numeric helper
