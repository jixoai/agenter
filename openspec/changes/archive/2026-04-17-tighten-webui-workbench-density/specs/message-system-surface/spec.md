## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface

The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The route shell and room-management dialogs SHALL use the shared scaffold-family primitives so the transcript, management rail, and dialog detail stage no longer repeat their own stretch-layout contracts. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail.

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

#### Scenario: Room administration opens in a dialog-sidebar management shell

- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management dialog with a left management rail and a right detail stage
- **THEN** the dialog organizes `Overview`, `Users`, and `Permissions` as section-level destinations without hiding the main transcript workflow
- **THEN** `Users` owns the `List | Add` membership workflow, including revoke/focus actions and the add-seat grant form
- **THEN** `Permissions` owns inline per-user role changes instead of mixing membership mutation and authority mutation in one panel
- **THEN** each stretchable detail section uses one explicit `ScrollView` owner instead of ad hoc overflow behavior

#### Scenario: Room management uses scaffold-family shells

- **WHEN** the operator opens room management or room creation
- **THEN** the surface uses scaffold-family primitives for fixed chrome, split rail/detail regions, and scroll ownership
- **THEN** the dialog no longer relies on page-local layout patches to keep headers visible and body regions scrollable
