# message-system-surface Specification

## Purpose
TBD - created by archiving change ship-message-system-core-surface. Update Purpose after archive.
## Requirements
### Requirement: Message-system SHALL present rooms as a standalone product surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript, and shows room users/access controls without depending on workspace or session ownership.

#### Scenario: Room catalog navigation
- **WHEN** the operator opens the message-system route
- **THEN** they can browse the global room catalog and select a room without first selecting a workspace or session

#### Scenario: Room transcript layout
- **WHEN** a room is selected
- **THEN** the route shows the transcript pane, user/access pane, and composer for that room in one coordinated surface

### Requirement: Message send SHALL require an explicit acting actor
The room composer SHALL let the operator choose which auth-backed actor sends a message, and message submission SHALL use that actor's room authority context.

#### Scenario: Send as a selected actor
- **WHEN** the operator chooses an actor in the composer and submits a room message
- **THEN** the message-system action is sent using that actor selection rather than an implicit global identity

#### Scenario: Missing or invalid actor authority
- **WHEN** the selected actor no longer has a valid room token or authority
- **THEN** the composer blocks submission and surfaces a credential-invalid state

### Requirement: Room users SHALL come from auth/profile truth
Room user lists, grant dialogs, and avatars SHALL resolve actors from auth/profile sources instead of generating local placeholder participants.

#### Scenario: Rendering room members
- **WHEN** the room user list renders
- **THEN** each visible user is derived from auth/profile data, including display name and avatar fallback behavior

#### Scenario: Granting a new user
- **WHEN** the operator opens room access management
- **THEN** the selectable users are sourced from the auth actor catalog instead of a local freeform list

### Requirement: Room read state SHALL use group read progress semantics
The room transcript SHALL present participant read progress and read timestamps, and SHALL NOT prioritize attention-style pending labels as the primary unread model.

#### Scenario: Participant read progress
- **WHEN** room messages contain read-state projections
- **THEN** the UI shows a progress indicator and participant read metadata for the message

#### Scenario: Transcript ordering
- **WHEN** the room list and transcript render
- **THEN** message ordering is driven by durable send time rather than a pending-attention heuristic

