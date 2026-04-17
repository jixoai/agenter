## ADDED Requirements

### Requirement: Workspace detail surfaces SHALL consume the shared split-detail layout law
Workspace routes that pair a primary left work surface with auxiliary right detail SHALL consume the shared split-detail layout law. Desktop workspace detail SHALL reuse the persisted ratio and resize handle, while compact workspace detail SHALL collapse through the shared right-sheet path without changing the available workspace capabilities.

#### Scenario: Desktop workspace detail uses the shared ratio-driven split
- **WHEN** the operator opens a workspace route on a container wide enough for persistent split detail
- **THEN** the route renders its left work surface and right auxiliary detail through the shared split-detail layout
- **THEN** the right detail width follows the shared ratio and clamp law instead of a route-local fixed drawer width

#### Scenario: Compact workspace detail preserves the same capabilities
- **WHEN** the workspace route no longer has enough width to satisfy the shared split minimums
- **THEN** the right auxiliary detail collapses into the shared compact right-sheet path
- **THEN** the operator still reaches the same mode switching, preview, and supporting detail capabilities without a separate route

### Requirement: Workspace toolbar SHALL remain view-centric while bottom-area owns functional editing
Workspace toolbar chrome SHALL stay responsible for page identity, mode switching, search, and other view-level controls. Functional editing actions for the current workspace task SHALL remain in the left-side page content, primarily its `bottom-area`, even when compact right detail is open.

#### Scenario: Rules editing stays in the bottom-area
- **WHEN** the operator edits workspace rules while the route exposes auxiliary right detail
- **THEN** add, duplicate, delete, and apply actions remain in the `bottom-area`
- **THEN** opening or closing right detail does not move those rule-editing actions into the toolbar

#### Scenario: Explorer and Private keep toolbar focused on view switching
- **WHEN** the operator switches between `Explorer`, `Rules`, and `Private` while a workspace detail surface is available
- **THEN** the toolbar continues to express mode/view controls rather than detail-local task actions
- **THEN** compact right-detail takeover only replaces the toolbar with a close affordance for the open view, not with a new action bar
