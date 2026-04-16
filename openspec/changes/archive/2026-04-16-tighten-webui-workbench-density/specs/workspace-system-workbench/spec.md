## ADDED Requirements

### Requirement: Workspace start page SHALL prioritize workspace scanning before secondary summary
The fixed `Workspaces` start page SHALL behave as a list-first chooser. The root list SHALL remain the dominant first-screen surface, while the secondary detail panel SHALL stay factual and brief instead of consuming equal visual weight through low-signal framing.

#### Scenario: Mobile start page keeps multiple roots visible before entry
- **WHEN** the operator opens `Workspaces` on an iPhone 14-sized viewport
- **THEN** the first screen still shows multiple workspace roots as immediately tappable rows
- **THEN** the route does not spend the majority of its visible height on a detached summary panel before root scanning begins

#### Scenario: Start-page detail summary stays factual
- **WHEN** the operator selects one workspace root on the start page without entering it yet
- **THEN** the secondary detail surface only shows short factual identity and entry summary for that root
- **THEN** the route does not expand that summary into a low-value showcase card that competes with the chooser list

### Requirement: Compact workspace stages SHALL preserve primary viewport budget
On compact workspace viewports, the shared content header, main stage, bottom-area, and right detail SHALL preserve the primary tree or rule-catalog viewport as the dominant task surface. Supporting chrome SHALL compress before the primary stage loses its working height.

#### Scenario: Compact explorer keeps the tree as the dominant surface
- **WHEN** the operator opens a workspace detail route on a compact viewport
- **THEN** the shared content header and bottom-area compress enough that the explorer tree still owns the main visible viewport budget
- **THEN** supporting surfaces do not consume more visual height than the current tree selection workflow

#### Scenario: Compact bottom-area becomes a dense support dock
- **WHEN** the operator is in `Explorer`, `Rules`, or `Private` on a compact viewport
- **THEN** the bottom-area keeps the same actions reachable through a denser dock-like presentation
- **THEN** the route does not re-expand those actions into a second tall card that pushes the primary stage off screen

## MODIFIED Requirements

### Requirement: Workspace modes SHALL share one content header with `View as` avatar switching and root-path context
The `Explorer`, `Rules`, and `Private` workspace modes SHALL reuse one shared `page-content` header that exposes a `View as` avatar switcher plus the current workspace root path. The `View as` control SHALL show avatar identity with both icon/avatar mark and nickname. That header SHALL preserve these facts while staying density-aware across desktop and compact viewports, and SHALL NOT expand into a detached oversized hero card.

#### Scenario: Switch workspace mode without losing shared header context
- **WHEN** the user switches between `Explorer`, `Rules`, and `Private`
- **THEN** the content header still shows the same `View as` avatar control and workspace root path
- **THEN** mode changes do not create three unrelated page-header patterns

#### Scenario: Change the `View as` avatar
- **WHEN** the user opens the `View as` dropdown and selects another avatar
- **THEN** the workbench updates the visible workspace lens to that avatar
- **THEN** the header continues to show the avatar icon/avatar mark plus nickname for the active lens

#### Scenario: Compact header keeps one concise workspace identity
- **WHEN** the workspace content header renders on a compact viewport
- **THEN** it keeps one concise workspace identity label visible alongside the active `View as` control
- **THEN** the full workspace path remains available through the same header affordance instead of forcing a second expanded title block

#### Scenario: Desktop header stays integrated with the workbench body
- **WHEN** the workspace content header renders on a desktop-sized viewport
- **THEN** it still reads as one integrated workbench content surface rather than a detached oversized card
- **THEN** extra whitespace or framing does not outweigh the actual workspace facts it is meant to convey
