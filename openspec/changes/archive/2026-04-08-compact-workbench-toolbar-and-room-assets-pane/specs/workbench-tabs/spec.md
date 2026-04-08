## MODIFIED Requirements

### Requirement: Workbench chrome SHALL provide a responsive toolbar companion

The shared workbench chrome SHALL include a reusable toolbar companion that keeps local information and actions readable across compact and wide layouts while remaining a fixed-height chrome slot. The shared toolbar primitive SHALL provide viewport state and container-query hooks, but page-specific content layout remains the responsibility of the consuming workbench surface.

#### Scenario: Toolbar slot stays fixed while content adapts

- **WHEN** a workbench renders its local title, actions, or dense metadata inside the shared toolbar on a compact viewport or narrow container
- **THEN** the toolbar slot remains fixed at `48px`
- **THEN** the workbench adapts its own content inside that slot instead of growing the shared chrome vertically

#### Scenario: Shared toolbar primitive does not encode page-owned row semantics

- **WHEN** a page needs a dense or specialized toolbar layout
- **THEN** the shared toolbar primitive exposes only responsive state and slot/container hooks
- **THEN** the page itself decides how to arrange its local toolbar content inside the fixed chrome slot
