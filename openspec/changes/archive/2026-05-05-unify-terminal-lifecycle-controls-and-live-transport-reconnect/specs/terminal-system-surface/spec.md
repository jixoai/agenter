## MODIFIED Requirements

### Requirement: Actions reflect explicit lifecycle operations

The terminal-system route SHALL keep PTY lifecycle operations route-owned and distinct from destructive terminal catalog deletion.

#### Scenario: Page-toolbar and titlebar project one lifecycle owner
- **WHEN** the selected terminal route renders lifecycle controls in both the page-toolbar and the terminal-window titlebar
- **THEN** both controls emit the same route-owned lifecycle action type
- **AND** busy state, lifecycle labels, and destructive confirmation rules stay aligned across both projections

#### Scenario: Kill PTY requires confirmation
- **WHEN** the operator requests `Kill PTY` from either lifecycle projection
- **THEN** the route opens one confirmation dialog before calling the stop mutation
- **AND** cancelling the dialog does not stop the PTY

#### Scenario: Bootstrap stays a lifecycle action
- **WHEN** the operator requests `Bootstrap PTY`
- **THEN** the route starts the PTY from the current durable terminal configuration
- **AND** the lifecycle control itself does not become an inline launch-parameter editor

#### Scenario: Running terminal exposes kill separately from deletion
- **WHEN** a terminal is `running`
- **THEN** the route exposes `Kill PTY` as the lifecycle operation
- **AND** terminal deletion remains a separate destructive catalog action outside the lifecycle control primitive
