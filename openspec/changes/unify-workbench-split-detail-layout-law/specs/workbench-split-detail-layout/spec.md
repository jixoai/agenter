## ADDED Requirements

### Requirement: Workbench split-detail layout SHALL persist desktop ratio through a configurable source
The system SHALL provide a shared `main + right detail` workbench layout whose desktop split position is modeled as a percentage ratio rather than a fixed pixel width. The layout SHALL accept either a string key that uses the default global persistence source or a custom provider that implements read, write, and subscribe semantics.

#### Scenario: String key uses the default shared ratio source
- **WHEN** a route mounts the shared split-detail layout with a string ratio key
- **THEN** the layout resolves its initial desktop ratio from the default shared persistence source
- **THEN** subsequent drag updates are written back through that same source without route-local storage code

#### Scenario: Custom provider overrides persistence behavior
- **WHEN** a route mounts the shared split-detail layout with a custom ratio provider
- **THEN** the layout reads, writes, and subscribes through that provider instead of the default global source
- **THEN** the route can scope ratio persistence without forking the shared layout logic

### Requirement: Workbench split-detail layout SHALL derive mode from LTR clamp math
The shared split-detail layout SHALL resolve widths in LTR order, treating the ratio as the left-area share of the available split width. The layout SHALL clamp resolved widths against configurable minimum widths and SHALL enter compact mode once available width cannot satisfy `leftMin + handleWidth + rightMin`.

#### Scenario: Desktop resize keeps ratio semantics while honoring minimum widths
- **WHEN** the operator drags the shared resize handle on a wide container
- **THEN** the layout updates the stored ratio instead of persisting raw pixel widths
- **THEN** the resolved left and right widths stay clamped to their configured minimum widths

#### Scenario: Insufficient width collapses to compact mode
- **WHEN** the available split container width falls below the configured `leftMin + handleWidth + rightMin`
- **THEN** the layout exits persistent split mode and enters compact mode
- **THEN** it does not keep shrinking either side below its configured minimum width just to preserve the desktop split

### Requirement: Compact right detail SHALL use a shared right-sheet with toolbar close takeover
When the shared split-detail layout is in compact mode, the right detail SHALL render as a shared `rightSheet` that still belongs to the same `page-content` contract. While that sheet is open, the shared page-toolbar affordance SHALL switch to `close-only` so the detail view is always dismissible from the toolbar position.

#### Scenario: Opening compact detail takes over toolbar close ownership
- **WHEN** a compact route opens the right detail sheet
- **THEN** the toolbar hides its normal route-local content
- **THEN** the toolbar renders a shared close affordance for the open right detail sheet

#### Scenario: Closing compact detail restores normal toolbar content
- **WHEN** the operator closes the compact right detail sheet
- **THEN** the toolbar removes the shared close-only takeover affordance
- **THEN** the route-local toolbar content becomes visible again without remounting a separate page shell
