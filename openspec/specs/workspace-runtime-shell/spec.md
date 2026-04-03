# workspace-runtime-shell Specification

## Purpose
Define the durable running-avatar runtime shell that sits behind `Running Avatars` and workspace-local avatar entry points.
## Requirements
### Requirement: Running-avatar detail SHALL be a secondary runtime surface
The WebUI SHALL expose running-avatar detail through a secondary runtime shell that is entered from `Running Avatars` or from workspace-local avatar or session actions, rather than through primary application navigation. In the active Svelte WebUI this shell SHALL be addressable through a dedicated runtime route and SHALL preserve reload-safe deep linking.

#### Scenario: Secondary navigation opens the running-avatar shell
- **WHEN** the user activates an entry from `Running Avatars`
- **THEN** the application opens the running-avatar detail shell for that session
- **THEN** the current primary destination remains `Workspaces`, `History`, `Messages`, `Terminals`, or `Settings`

#### Scenario: Workspace avatar actions open the same shell
- **WHEN** the user opens a running avatar from a workspace-local avatar or session action
- **THEN** the application opens the same running-avatar detail shell model used by the secondary rail
- **THEN** the detail behavior does not depend on which launcher initiated it

### Requirement: Running-avatar detail SHALL use a primary runtime stage plus a secondary facts rail
The runtime shell SHALL present the active tab content as the primary stage and SHALL keep linked systems, runtime facts, and auxiliary navigation in a visually quieter secondary rail.

#### Scenario: Attention opens with a strong primary stage
- **WHEN** the user opens the runtime shell on `Attention`
- **THEN** the page shows a summary band plus a primary attention stage that explains the current runtime state
- **THEN** linked systems and runtime facts remain available in a smaller secondary rail instead of competing as peer empty canvases

#### Scenario: Peer runtime tabs reuse the same shell hierarchy
- **WHEN** the user switches to `Cycles`, `Systems`, `Observability`, or `Settings`
- **THEN** the selected tab renders through the same primary-stage shell model
- **THEN** the right rail remains secondary and does not become the dominant surface

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

### Requirement: Running-avatar detail SHALL expose flat runtime-specific peer tabs
The running-avatar detail shell SHALL expose flat runtime-specific peer tabs. Former Devtools sub-tabs and `Settings` SHALL remain siblings at the same hierarchy level, and the default selected tab SHALL be `Attention`.

#### Scenario: Runtime peer tabs are visible at the same level
- **WHEN** the user opens a running-avatar detail shell
- **THEN** `Attention`, `Cycles`, `Systems`, `Observability`, and `Settings` are available as peer tabs in the same shell layer
- **THEN** the user does not descend through a nested tab stack to reach technical runtime surfaces

#### Scenario: Attention is the default runtime tab
- **WHEN** the user opens a running-avatar detail shell without an explicit tab
- **THEN** the shell lands on `Attention` by default
- **THEN** the most critical runtime surface is visible without an extra tab switch

### Requirement: Running-avatar detail SHALL link out to global resource pages instead of duplicating them
The running-avatar detail shell SHALL NOT duplicate the global `Chats` or `Terminals` browsing surfaces, and it SHALL use explicit links or source jumps when the user needs to inspect a room or terminal.

#### Scenario: Room or terminal inspection leaves the runtime shell
- **WHEN** the user requests to inspect a room or terminal from inside running-avatar detail
- **THEN** the application navigates to the corresponding global `Chats` or `Terminals` surface
- **THEN** the runtime shell does not render a second embedded room or terminal catalog of its own

