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

#### Scenario: Room administration opens in a dialog-sidebar management shell
- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management dialog with a left management rail and a right detail stage
- **THEN** the dialog organizes `Overview`, `Users`, and `Access` as section-level destinations without hiding the main transcript workflow
- **THEN** each stretchable detail section uses one explicit `ScrollView` owner instead of ad hoc overflow behavior

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

### Requirement: Room read state SHALL use message-level group read progress semantics
The room transcript SHALL present participant read progress and read timestamps as message-level collaboration facts, and SHALL NOT project latest-read progress as a room-header aggregate chip or as an attention-style pending label.

#### Scenario: Participant read progress
- **WHEN** room messages contain read-state projections
- **THEN** the UI shows a per-message inline-end progress indicator for that message
- **THEN** a fully read message upgrades that indicator into a completed check state instead of a room-level `x/y read` badge

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
The message-system route SHALL treat the transcript as the primary center surface and place navigation, management, and secondary facts into responsive containers such as left-side room lists, dialog sidebars, tabs, or compact sheets according to available space. When a room is selected, the workbench window SHALL render explicit `chrome_tabs`, `page_toolbar`, and `page_content` bands, and the toolbar SHALL remain outside transcript flow.

#### Scenario: Compact viewport preserves the transcript stage
- **WHEN** the operator uses the message-system route on a narrow viewport
- **THEN** the room list and room management controls are available through compact navigation or dialog surfaces
- **THEN** the transcript and composer remain the default visible stage

#### Scenario: Desktop viewport reveals richer secondary context
- **WHEN** the operator uses the message-system route on a desktop-sized viewport
- **THEN** the room catalog may remain visible beside the selected transcript
- **THEN** secondary room controls can expand without demoting the transcript from the primary task surface

#### Scenario: Selected room keeps toolbar chrome outside transcript flow
- **WHEN** a room tab is active
- **THEN** avatar, viewer title, actions, and room-mode chips render inside the fixed `page_toolbar` band
- **THEN** those controls do not overlap or visually collapse into the transcript list

### Requirement: Message-system tabs SHALL resolve canonical room icon identity
The message-system workbench SHALL render icon-bearing tabs for fixed views and room views. Dynamic room tabs SHALL resolve room-owned icons from the canonical icon authority instead of falling back to label-only initials as the durable navigation model.

#### Scenario: Room tab shows canonical room icon
- **WHEN** the operator opens or reopens a room tab in Messages
- **THEN** that tab renders the room's canonical icon from the room icon authority
- **THEN** the tab does not rely on a feature-local initials-only fallback as its primary identity surface

#### Scenario: Fixed tabs keep stable non-room icons
- **WHEN** the workbench renders fixed tabs such as `New room`
- **THEN** those tabs still render their stable non-room icon affordances
- **THEN** the presence of room icons does not remove icon affordances from the rest of the workbench

### Requirement: Message-system route SHALL expose a rich shared room transcript surface
The selected room transcript SHALL present canonical avatars, improved message bubbles, attachment rendering, and local hover/context actions through the shared chat component, while keeping room orchestration and management outside the transcript renderer.

#### Scenario: Hover or context interaction reveals room message actions
- **WHEN** the operator hovers a room message or opens its context menu
- **THEN** the transcript exposes the shared local message action affordances for that message
- **THEN** the route does not need a second feature-local bubble implementation to provide those actions

#### Scenario: Room attachment renders after reload
- **WHEN** the operator reloads a room whose transcript contains persisted room attachments
- **THEN** the transcript renders those attachments with kind-appropriate preview or file affordances
- **THEN** the operator can inspect the same room history without re-uploading the assets
