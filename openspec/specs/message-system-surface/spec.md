# message-system-surface Specification

## Purpose
Define the durable operator-facing contract for the standalone message-system route, including shared room transcript rendering, actor-scoped sending, auth-backed access management, read progress, and live room updates.
## Requirements
### Requirement: Message-system SHALL present rooms as a standalone product surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail.

#### Scenario: Room catalog navigation
- **WHEN** the operator opens the message-system route
- **THEN** they can browse the global room catalog and select a room without first selecting a workspace or session

#### Scenario: Chat-first room transcript layout
- **WHEN** a room is selected
- **THEN** the route shows the transcript pane and composer as the primary surface for that room
- **THEN** the transcript pane is rendered through the shared chat component rather than a route-local one-off renderer

#### Scenario: Explicit viewer perspective
- **WHEN** the operator changes the selected room viewer
- **THEN** the transcript rerenders from that viewer's perspective instead of guessing from message labels or the current route owner
- **THEN** the selected viewer does not change which actor is configured in the `Send as` control unless the operator changes it explicitly

#### Scenario: Room administration opens in a management surface
- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management surface instead of keeping those controls permanently expanded beside the transcript
- **THEN** the management surface organizes room overview, users, and access actions without hiding the main chat workflow

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

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth
The room viewer selector, room management surface, send-as options, and read-progress details SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses.

#### Scenario: Viewer selector lists canonical actors
- **WHEN** the operator opens the room viewer selector
- **THEN** each option is keyed by canonical actor identity
- **THEN** duplicate visible labels remain selectable as separate actors

### Requirement: Room read state SHALL use group read progress semantics
The room transcript SHALL present participant read progress and read timestamps, and SHALL NOT prioritize attention-style pending labels as the primary unread model.

#### Scenario: Participant read progress
- **WHEN** room messages contain read-state projections
- **THEN** the UI shows a progress indicator and participant read metadata for the message

#### Scenario: Transcript ordering
- **WHEN** the room list and transcript render
- **THEN** message ordering is driven by durable send time rather than a pending-attention heuristic

### Requirement: Message-system route SHALL reflect room changes live
The message-system route SHALL react to room catalog updates, new messages, read-state changes, grant changes, and seat focus changes without requiring manual refresh or periodic polling to reveal those facts.

#### Scenario: Sent room message appears without refresh
- **WHEN** the operator or another authorized seat sends a room message
- **THEN** the selected room transcript updates in place without a page refresh
- **THEN** the room list ordering and preview facts update from the same live event stream

#### Scenario: Room access state changes propagate live
- **WHEN** a room grant, revoke, read-state, or seat focus update occurs
- **THEN** the user/access sidebar refreshes those facts in place
- **THEN** the `Send as` options and read progress indicators stay consistent with the latest room truth

### Requirement: Message-system route SHALL place secondary room controls responsively
The message-system route SHALL treat the transcript as the primary center surface and place navigation, management, and secondary facts into responsive containers such as left-side room lists, dialog sidebars, tabs, or compact sheets according to available space.

#### Scenario: Compact viewport preserves the transcript stage
- **WHEN** the operator uses the message-system route on a narrow viewport
- **THEN** the room list and room management controls are available through compact navigation or dialog surfaces
- **THEN** the transcript and composer remain the default visible stage

#### Scenario: Desktop viewport reveals richer secondary context
- **WHEN** the operator uses the message-system route on a desktop-sized viewport
- **THEN** the room catalog may remain visible beside the selected transcript
- **THEN** secondary room controls can expand without demoting the transcript from the primary task surface
