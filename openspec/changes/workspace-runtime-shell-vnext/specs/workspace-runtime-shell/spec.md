## ADDED Requirements

### Requirement: Running-avatar detail SHALL be a secondary runtime surface
The WebUI SHALL expose running-avatar detail through a secondary runtime shell that is entered from `Running Avatars` or from workspace-local avatar/session actions, rather than through primary application navigation.

#### Scenario: Secondary navigation opens the running-avatar shell
- **WHEN** the user activates an entry from `Running Avatars`
- **THEN** the application opens the running-avatar detail shell for that session
- **THEN** the current primary destination remains `Chats`, `Terminals`, or `Workspaces` rather than mutating into a fourth primary destination

#### Scenario: Workspace avatar actions open the same shell
- **WHEN** the user opens a running avatar from a workspace-local `Avatars` or session-related action
- **THEN** the application opens the same running-avatar detail shell model used by the secondary rail
- **THEN** the detail behavior does not depend on which launcher initiated it

### Requirement: Running-avatar detail SHALL expose flat runtime-specific peer tabs
The running-avatar detail shell SHALL expose flat runtime-specific peer tabs. Former Devtools sub-tabs and `Settings` SHALL remain siblings at the same hierarchy level, and the default selected tab SHALL be `Attention`.

#### Scenario: Runtime peer tabs are visible at the same level
- **WHEN** the user opens a running-avatar detail shell
- **THEN** `Attention`, `Cycles`, other runtime inspection tabs, and `Settings` are available as peer tabs in the same shell layer
- **THEN** the user does not need to descend through a nested Devtools tab stack just to switch between those runtime surfaces

#### Scenario: Attention is the default runtime tab
- **WHEN** the user opens a running-avatar detail shell
- **THEN** the shell lands on `Attention` by default
- **THEN** the user reaches the most critical runtime surface without an extra tab switch

### Requirement: Cycles tab SHALL surface the current running round as an active badge
The `Cycles` tab SHALL display the current running cycle number as a badge. When the avatar is actively running, the badge background SHALL follow the latest cycle-kind icon color and SHALL render a breathing state.

#### Scenario: Running avatar shows active cycle badge
- **WHEN** the running-avatar detail shell has an in-flight cycle
- **THEN** the `Cycles` tab badge shows the current running cycle number
- **THEN** the badge background uses the latest cycle-kind icon color and renders a breathing state

#### Scenario: Idle avatar shows the latest cycle number without breathing
- **WHEN** the running-avatar detail shell is not currently executing a cycle but has prior cycle history
- **THEN** the `Cycles` tab badge shows the latest known cycle number without a breathing state
- **THEN** the user can still scan the current round index without mistaking it for active execution

### Requirement: Running-avatar detail SHALL link out to global resource pages instead of duplicating them
The running-avatar detail shell SHALL NOT duplicate the global `Chats` or `Terminals` browsing surfaces, and it SHALL use explicit links or source jumps when the user needs to inspect a room or terminal.

#### Scenario: Room or terminal inspection leaves the runtime shell
- **WHEN** the user requests to inspect a room or terminal from inside running-avatar detail
- **THEN** the application navigates to the corresponding global `Chats` or `Terminals` surface
- **THEN** the runtime shell does not render a second embedded room or terminal catalog of its own
