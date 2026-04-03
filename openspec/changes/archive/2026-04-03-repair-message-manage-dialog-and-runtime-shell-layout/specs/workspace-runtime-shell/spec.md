## MODIFIED Requirements

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
