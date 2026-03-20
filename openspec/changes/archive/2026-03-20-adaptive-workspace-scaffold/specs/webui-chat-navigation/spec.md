## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and that shell SHALL choose its route-navigation placement from an adaptive viewport model based on width class plus orientation. The global `AppHeader` MUST remain passive and application-scoped by keeping only application-level location, drawer access, and passive runtime state visible, while workspace route switching, workspace identity, and route-local actions stay inside the workspace shell. The shell MUST preserve explicit overflow ownership so route content provides its own primary scroll viewport.

#### Scenario: Expanded or landscape workspace route uses top navigation
- **WHEN** the user opens a workspace route on an expanded viewport or any landscape viewport
- **THEN** the workspace shell shows route navigation in the workspace header
- **THEN** the workspace shell does not render the bottom navigation bar

#### Scenario: Portrait compact workspace route uses bottom navigation
- **WHEN** the user opens a workspace route on a compact or medium portrait viewport
- **THEN** the workspace shell keeps workspace route navigation in the bottom navigation bar
- **THEN** the workspace header does not repeat the same route-tab controls

#### Scenario: Global header stays passive
- **WHEN** the user is inside a workspace route
- **THEN** the global app header shows only application-level location, passive runtime status, and the global drawer trigger when needed
- **THEN** the global app header does not render workspace path, workspace tabs, or session run controls

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the passive global header and route region, and the workspace shell owns the workspace header, route content viewport, and conditional bottom navigation. Each layer MUST express only its own context facts without repeating identity or action in adjacent layers.

#### Scenario: Workspace route content is not wrapped by duplicate padding stacks
- **WHEN** a workspace route renders Chat, Devtools, or Settings content
- **THEN** the outer application shell does not inject a second competing content padding layer inside the workspace scaffold
- **THEN** the workspace route keeps visual priority over surrounding shell chrome
