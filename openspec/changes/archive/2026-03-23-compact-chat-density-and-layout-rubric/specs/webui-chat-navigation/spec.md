## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The top header SHALL remain a passive, compact surface that keeps only navigation, location, passive state signals, workspace basename, and route switching visible, while route-local actions stay inside the route body.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the top header
- **THEN** the top header does not repeat the workspace path or route-local notices already rendered inside the workspace shell

#### Scenario: Open global settings outside the workspace shell
- **WHEN** the user activates the global settings entry from application chrome
- **THEN** the application navigates to a dedicated global settings route
- **THEN** the route is not rendered inside the workspace shell tabs

#### Scenario: Header shows workspace basename while full path stays secondary
- **WHEN** the user is inside a workspace route
- **THEN** the top header shows the workspace basename as the primary workspace label
- **THEN** the full workspace path is only available through a secondary affordance such as a tooltip or menu

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the passive top header and route region, and the workspace route surface owns route content plus route-local notices/actions. Adjacent shell layers MUST NOT repeat the same passive state as visible text if an icon signal or tooltip already owns that fact.

#### Scenario: Workspace route content is not wrapped by duplicate padding stacks
- **WHEN** a workspace route renders Chat, Devtools, or Settings content
- **THEN** the outer application shell does not inject a second competing content padding layer inside the workspace scaffold
- **THEN** the workspace route keeps visual priority over surrounding shell chrome

#### Scenario: Passive state signals avoid redundant text stacks
- **WHEN** the shell renders connection or AI state in the top header
- **THEN** those facts are expressed through compact signals with accessible tooltip-backed labels
- **THEN** the header does not also repeat the same passive state as additional long text lines unless the signal itself is unavailable
