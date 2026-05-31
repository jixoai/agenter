# message-system-surface Specification

## Purpose

Define the durable operator-facing contract for the standalone message-system route, including shared room transcript rendering, actor-scoped sending, auth-backed access management, read progress, room assets, and live room updates.

## Requirements

### Requirement: Message-system SHALL present rooms as a standalone app surface

The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The route shell and room-management dialogs SHALL use the shared scaffold-family primitives so the transcript, management rail, and dialog detail stage no longer repeat their own stretch-layout contracts. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail. Studio SHALL embed the Web Chat app-view through an iframe boundary for chat mode so the app-view owns Framework7 chat topology and backend room synchronization while Studio keeps room tabs, assets, search, and superadmin controls outside that island.

#### Scenario: Room catalog navigation

- **WHEN** the operator opens the message-system route
- **THEN** they can browse the global room catalog and select a room without first selecting a workspace or session

#### Scenario: New room title affordance matches fallback title

- **WHEN** the operator opens the `New room` route and leaves the title field blank
- **THEN** the route copy reflects that blank submission falls back to `Room`
- **THEN** the title input does not imply that some other example string will become the real room title

#### Scenario: Chat-first room transcript layout

- **WHEN** a room is selected
- **THEN** the route shows the transcript pane and composer as the primary surface for that room
- **THEN** the transcript pane is rendered through the shared chat component rather than a route-local one-off renderer

#### Scenario: Explicit viewer perspective

- **WHEN** the operator changes the selected room viewer
- **THEN** the transcript rerenders from that viewer's perspective instead of guessing from message labels or the current route owner
- **THEN** the selected viewer does not change which actor is configured in the `Send as` control unless the operator changes it explicitly

#### Scenario: Viewer preference survives room refresh

- **WHEN** the operator selects a `View as` actor for room `R`
- **AND** later reloads or reopens the same room on a new page load
- **THEN** the route restores that actor-private viewer preference for `R`
- **AND** if that actor is no longer a valid visible seat, the route falls back to canonical room viewer resolution instead of staying pinned to stale local memory

#### Scenario: Viewer preference survives same-browser refresh before auth-kv ack

- **WHEN** the operator changes `View as` for room `R`
- **AND** reloads the page before the auth-scoped KV write has been acknowledged
- **THEN** the route restores that pending room viewer from browser-local WAL instead of flashing back to an older fallback viewer
- **AND** the route replays the pending auth-scoped KV sync in the background until durable state catches up

#### Scenario: Dense room toolbar shows current viewer identity and room actions

- **WHEN** a room is selected
- **THEN** the fixed room toolbar shows the current `View as` user avatar and label as the primary identity
- **THEN** the toolbar exposes `search-messages`, `add-user`, and `manage` actions in that order
- **THEN** the toolbar exposes `chat` and `assets` chips as room-local body mode switches

#### Scenario: Compact room toolbar keeps all affordances inside the fixed band

- **WHEN** a room is selected on an iPhone 14-sized viewport with the fixed 48px room toolbar
- **THEN** the `View as` trigger, room action buttons, and `chat/assets` mode chips all remain fully visible inside the toolbar band
- **THEN** the toolbar does not clip those affordances vertically or push them outside the fixed chrome region

#### Scenario: Dense room chrome avoids redundant card treatment inside content

- **WHEN** the operator views room-local chrome such as the compact toolbar or body-mode affordances
- **THEN** those controls use the minimum border and rounding needed for affordance clarity
- **THEN** the route does not reintroduce heavy nested card framing inside the shared message workbench body

#### Scenario: Compact room composer keeps send inline with the action rail

- **WHEN** a room is selected on an iPhone 14-sized viewport with the shared room composer idle
- **THEN** the `Attach`, `Screenshot`, and `Send` actions stay inside one compact action rail instead of forcing a full-width send row
- **THEN** the composer does not spend a second dedicated chrome band on passive action affordances

#### Scenario: Compact room composer keeps explicit action borders

- **WHEN** the shared room composer renders `Attach` or `Screenshot` as clickable buttons
- **THEN** those actions keep a visible button border even inside the dense room footer
- **THEN** density tuning does not collapse `outline` actions into borderless text or icon fragments

#### Scenario: Passive room composer metadata stays low-noise

- **WHEN** the operator is idle in the room composer without pending assets or an active submit/disabled state
- **THEN** passive shortcut/help metadata collapses into low-emphasis text or compact hiding instead of badge-like pill clusters
- **THEN** the composer preserves transcript height instead of presenting another nested footer card

#### Scenario: Dense room transcript avoids decorative slack

- **WHEN** the operator reads an active room transcript on desktop or mobile
- **THEN** transcript rows use compact vertical spacing and do not burn height on decorative top/bottom padding
- **THEN** message bubbles keep only the minimum radius, border, and shadow needed to distinguish ownership and tone
- **THEN** the transcript viewport and footer transition keep the message stream dominant instead of creating large dead zones

#### Scenario: Room body switches between chat and assets without extra chrome inside content

- **WHEN** the operator toggles `chat` or `assets`
- **THEN** `page_content` renders exactly one room body mode at a time
- **THEN** `chat` shows the shared transcript/composer surface
- **THEN** `assets` shows the room-owned asset list
- **THEN** the room body does not add a second room header or toolbar inside `page_content`

#### Scenario: Studio embeds the Web Chat app-view island

- **WHEN** Studio renders a selected room in chat mode
- **THEN** the room body loads the Web Chat app-view through an iframe boundary
- **AND** the iframe URL selects partial room mode with explicit room transport URL, viewer token, and viewer contact id
- **AND** app-view owns the Framework7 `App`, `View`, `Page messagesContent`, transcript, and composer responsibilities
- **AND** Studio keeps room tabs, asset switching, search, and superadmin management controls outside that island
- **AND** Studio does not rely on Workbench layout containers to impersonate Framework7 page topology
- **AND** Studio does not introduce resize or event bridges for ordinary transcript state, because the backend is the shared source of truth

#### Scenario: Room administration opens in a dialog-sidebar management shell

- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management dialog with a left management rail and a right detail stage
- **THEN** the dialog organizes `Overview`, `Users`, and `Permissions` as section-level destinations without hiding the main transcript workflow
- **THEN** `Users` owns the `List | Add` membership workflow, including revoke/focus actions and the add-seat grant form
- **THEN** `Permissions` owns inline per-user role changes instead of mixing membership mutation and authority mutation in one panel
- **THEN** each stretchable detail section uses one explicit `ScrollView` owner instead of ad hoc overflow behavior

#### Scenario: Room management can reopen after dismissal

- **WHEN** the operator dismisses the room management dialog and later presses `Manage room` or `Add user` again
- **THEN** the same room management dialog shell opens again immediately
- **THEN** the page does not remain inert or stuck behind stale dialog-open state

#### Scenario: Room management uses scaffold-family shells

- **WHEN** the operator opens room management or room creation
- **THEN** the surface uses scaffold-family primitives for fixed chrome, split rail/detail regions, and scroll ownership
- **THEN** the dialog no longer relies on page-local layout patches to keep headers visible and body regions scrollable

### Requirement: Message send SHALL require an explicit acting actor

The room composer SHALL let the operator choose which auth-backed actor sends a message, and message submission SHALL use that actor's room authority context.

#### Scenario: Send as a selected actor

- **WHEN** the operator chooses an actor in the composer and submits a room message
- **THEN** the message-system action is sent using that actor selection rather than an implicit global identity

#### Scenario: Missing or invalid actor authority

- **WHEN** the selected actor no longer has a valid room token or authority
- **THEN** the composer blocks submission and surfaces a credential-invalid state

### Requirement: Browser-facing global room control SHALL require an authenticated operator

The browser-side message-system workbench SHALL require an authenticated operator before it can create rooms, hydrate global room state, or use room seat tokens for room mutation. A room `accessToken` is a room capability inside the authenticated control plane, not an anonymous browser identity.

#### Scenario: Unauthenticated browser cannot create rooms

- **WHEN** the browser opens the `New room` route without an authenticated operator session
- **THEN** the route shows an explicit `auth token required` notice
- **THEN** the `Create room` action stays disabled instead of issuing anonymous room mutations

#### Scenario: Room token alone does not authorize browser mutation

- **WHEN** the browser is not authenticated but still holds a stale room id or room seat token
- **THEN** the room composer and room mutation actions do not stay active from that stale token alone
- **THEN** the route surfaces `auth token required` until the operator authenticates again

### Requirement: Room users SHALL come from auth/profile truth

Room user lists, grant dialogs, and avatars SHALL resolve actors from auth/profile sources instead of generating local placeholder participants.

#### Scenario: Rendering room members

- **WHEN** the room user list renders
- **THEN** each visible user is derived from auth/profile data, including display name and avatar fallback behavior

#### Scenario: Granting a new user

- **WHEN** the operator opens room access management
- **THEN** the selectable users are sourced from the auth actor catalog instead of a local freeform list

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management surface, send-as options, and room seat metadata SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses. Room management MAY show seat role, focus, presence, and credential state, but it SHALL NOT present room-level latest-visible read labels for those seats.

#### Scenario: Viewer selector lists canonical actors

- **WHEN** the operator opens the room viewer selector
- **THEN** each option is keyed by canonical actor identity
- **THEN** duplicate visible labels remain selectable as separate actors

#### Scenario: Default viewer follows the active room credential actor

- **WHEN** the operator opens a room without a previously stored `View as` selection
- **AND** the current room credential resolves to actor `A` while another room seat sorts earlier in the viewer list
- **THEN** the route selects `A` as the default viewer
- **THEN** transcript alignment, read acknowledgement, and send-token derivation start from that credential actor instead of the sorted fallback seat

#### Scenario: Session-backed viewer title prefers canonical session identity even after stop

- **WHEN** the selected room viewer resolves to a session-backed actor that still exists in active client session metadata
- **AND** that session exposes both a human `avatar` label and an opaque runtime `name`
- **THEN** the Room toolbar and viewer selector use the avatar label as the primary visible title
- **THEN** any raw session id remains secondary detail only when needed for disambiguation

#### Scenario: Internal bootstrap control seat stays out of user-facing selectors

- **WHEN** the selected room is owned by an internal bootstrap control seat
- **THEN** the control seat does not appear as a normal `Users` entry, viewer choice, or ordinary `Send as` actor
- **THEN** authenticated human or avatar actors remain the only user-facing membership choices unless a surface explicitly describes control-plane metadata

#### Scenario: Room manage users stays seat-oriented

- **WHEN** the operator opens room management for `Users`
- **THEN** each visible user row is resolved from canonical actor truth
- **AND** the surface may show role, focus, presence, and credential status for that seat
- **AND** it does not show `Read`, `Unread`, or `Joined later` badges derived from the latest visible room message

### Requirement: Room read state SHALL use message-level group read progress semantics

The room transcript SHALL present collaboration read state as message-level facts attached to message rows. The route SHALL NOT reintroduce room-level read summaries in the room toolbar, management shell, or any auxiliary room seat surface.

#### Scenario: Participant read progress

- **WHEN** room messages contain read-state projections
- **THEN** the UI shows a per-message inline-end progress indicator for that message
- **THEN** a fully read message upgrades that indicator into a completed check state instead of a room-level `x/y read` badge

#### Scenario: Message-level read detail uses canonical room actors

- **WHEN** the operator opens a message's read-progress indicator
- **THEN** the disclosure shows canonical actor name and avatar rows in `Read` and `Unread` columns for that message
- **THEN** the route derives those rows from canonical actor truth instead of guessing from raw ids inside `web-chat-view`

#### Scenario: Transcript ordering

- **WHEN** the room list and transcript render
- **THEN** message ordering is driven by durable send time rather than a pending-attention heuristic

#### Scenario: Room surfaces avoid room-level read summary chrome

- **WHEN** the operator views a room toolbar, room-management dialog, or room seat list
- **THEN** those surfaces do not summarize the room as `x/y read`
- **AND** they do not present “current room latest progress” as a separate room-level fact
- **AND** read inspection remains attached to the relevant message row

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

The message-system workbench SHALL render icon-bearing tabs for fixed views and room views. Dynamic room tabs SHALL resolve room-owned icons from the canonical icon authority instead of falling back to label-only initials as the durable navigation model. The workbench chrome SHALL remain renderable while the room catalog is still hydrating, and fixed tabs such as `New room` SHALL NOT blank the page during that initial mount path.

#### Scenario: Room tab shows canonical room icon

- **WHEN** the operator opens or reopens a room tab in Messages
- **THEN** that tab renders the room's canonical icon from the room icon authority
- **THEN** the tab does not rely on a feature-local initials-only fallback as its primary identity surface

#### Scenario: Fixed tabs keep stable non-room icons

- **WHEN** the workbench renders fixed tabs such as `New room`
- **THEN** those tabs still render their stable non-room icon affordances
- **THEN** the presence of room icons does not remove icon affordances from the rest of the workbench

#### Scenario: Initial room hydration keeps the workbench chrome mounted

- **WHEN** the operator opens `/messages`, `/messages/new`, or a room deep link before the first room-catalog response resolves
- **THEN** the route still renders the workbench chrome with its fixed tab affordances instead of a blank page
- **THEN** the initial hydration path does not throw a client runtime error while the room catalog transitions from idle to loading

### Requirement: Message-system route SHALL expose a rich shared room transcript surface

The selected room transcript SHALL present canonical avatars, improved message bubbles, attachment rendering, local hover/context actions, and local transcript search while keeping room orchestration and management outside the transcript renderer.

#### Scenario: Hover or context interaction reveals room message actions

- **WHEN** the operator hovers a room message or opens its context menu
- **THEN** the transcript exposes the shared local message action affordances for that message
- **THEN** the route does not need a second feature-local bubble implementation to provide those actions

#### Scenario: Transcript actor subtitle stays quiet until disambiguation is needed

- **WHEN** a room message sender has a unique visible label within the current room
- **THEN** the transcript row does not show selector-level technical subtitle detail such as workspace path or raw actor id
- **THEN** that subtitle only appears once duplicate visible labels require disambiguation

#### Scenario: Room attachment renders after reload

- **WHEN** the operator reloads a room whose transcript contains persisted room attachments
- **THEN** the transcript renders those attachments with kind-appropriate preview or file affordances
- **THEN** the operator can inspect the same room history without re-uploading the assets

#### Scenario: Local transcript search navigates loaded room messages

- **WHEN** the operator invokes `search-messages` from the room toolbar
- **THEN** the room can search within the currently loaded transcript messages

#### Scenario: Local transcript search can reopen after dismissal

- **WHEN** the operator closes the local transcript search dialog and later invokes `search-messages` again
- **THEN** the same search dialog reopens immediately
- **THEN** the page does not remain inert behind stale dialog body-lock state
- **THEN** search navigation uses transcript row anchors instead of requiring a second route-local message renderer
