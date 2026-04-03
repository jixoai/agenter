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
