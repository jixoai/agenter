# workspace-runtime-shell Specification

## Purpose
Define the durable running-avatar runtime shell that sits behind the `Avatars` workbench and workspace-local avatar entry points.

## Requirements
### Requirement: Running-avatar detail SHALL be a secondary runtime surface
The WebUI SHALL expose running-avatar detail through dynamic session tabs inside the `Avatars` workbench and through workspace-local avatar or session actions, rather than through a separate secondary `Running Avatars` detail rail. In the active Svelte WebUI this shell SHALL remain addressable through dedicated runtime routes and SHALL preserve reload-safe deep linking.

#### Scenario: Dynamic avatar tab opens the running-avatar shell
- **WHEN** the user activates a running-avatar tab from the `Avatars` workbench
- **THEN** the application opens the running-avatar detail shell for that session
- **THEN** the current primary destination remains `Avatars`, `Messages`, or `Terminals`

#### Scenario: Workspace avatar actions open the same shell
- **WHEN** the user opens a running avatar from a workspace-local avatar or session action
- **THEN** the application opens the same running-avatar detail shell model used by the dynamic avatar tab
- **THEN** the detail behavior does not depend on which launcher initiated it

### Requirement: Running-avatar detail SHALL keep one primary runtime stage without a parallel facts rail
The runtime shell SHALL present the active tab content as the single primary stage, and linked systems, runtime facts, and source jumps SHALL be integrated into stage-local surfaces instead of a parallel secondary facts rail. The route shell and stage panels SHALL derive their structure from shared scaffold-family primitives instead of local split-layout classes.

#### Scenario: Runtime shell derives from shared scaffold law without duplicate detail panes
- **WHEN** the user opens a runtime route
- **THEN** the page uses shared scaffold primitives to allocate the primary stage without a competing secondary rail
- **THEN** the stage header stays outside the body scroll region without page-local stretch-layout patches

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

### Requirement: Runtime shell routes land on a canonical runtime tab
The workspace runtime shell SHALL expose a canonical runtime destination for each avatar session and SHALL route runtime entry URLs to that tab without requiring feature-level navigation glue.

#### Scenario: Runtime rail links land on attention by default
- **WHEN** the operator opens a session from the runtime rail or a direct runtime entry URL without a tab segment
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/attention`
- **AND** the runtime shell renders without an intermediate error page

### Requirement: Running-avatar detail SHALL link out to global resource pages instead of duplicating them
The running-avatar detail shell SHALL NOT duplicate the global `Chats` or `Terminals` browsing surfaces, and it SHALL use explicit links or source jumps when the user needs to inspect a room or terminal.

#### Scenario: Room or terminal inspection leaves the runtime shell
- **WHEN** the user requests to inspect a room or terminal from inside running-avatar detail
- **THEN** the application navigates to the corresponding global `Chats` or `Terminals` surface
- **THEN** the runtime shell does not render a second embedded room or terminal catalog of its own
