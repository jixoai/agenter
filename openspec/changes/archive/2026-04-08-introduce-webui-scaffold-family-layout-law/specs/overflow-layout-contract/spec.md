## MODIFIED Requirements

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, fixed controls, and semantic chrome remain outside that viewport. Layout-critical surfaces SHALL express this ownership through the shared scaffold-family primitives so feature code no longer hand-authors the stretch shell for each page or dialog.

#### Scenario: Scaffold owns fixed-vs-stretch structure
- **WHEN** a page surface or dialog needs fixed chrome plus one scrolling body
- **THEN** it uses a shared scaffold primitive to declare the fixed and stretch regions
- **THEN** feature code does not rebuild the same shell contract with ad hoc `grid/flex + h-full + minmax(0,1fr)` composition

#### Scenario: Shared scaffold slots retain their row ownership when optional regions are omitted
- **WHEN** a scaffold-family surface omits its header or footer region
- **THEN** `Body` or `ScrollBody` still binds to the dedicated stretch row instead of auto-flowing into the first available row
- **THEN** transcript, terminal, and dialog stages keep their dominant viewport height without local `min-h-0` rescue patches

#### Scenario: Shared split variants do not depend on consumer Tailwind generation
- **WHEN** a consumer route imports `SplitView` from `@agenter/svelte-components`
- **THEN** the responsive column and row law is owned by package-local CSS/media rules
- **THEN** first-level routes do not silently collapse into one stacked column because the consuming app failed to generate a shared utility class
