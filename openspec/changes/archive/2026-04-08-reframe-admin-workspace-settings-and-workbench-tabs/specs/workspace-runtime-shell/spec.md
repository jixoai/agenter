## MODIFIED Requirements

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
