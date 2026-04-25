## MODIFIED Requirements

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, fixed controls, and semantic chrome remain outside that viewport. Layout-critical surfaces SHALL express this ownership through the shared scaffold-family primitives so feature code no longer hand-authors the stretch shell for each page or dialog. When raw clipping is removed from layout wrappers, the replacement layout MUST explicitly restore scrolling through the shared `ScrollView` primitive on the real scroll owner.

#### Scenario: Panel with long content remains operable
- **WHEN** a panel contains content taller than the available viewport
- **THEN** the panel exposes a single primary scroll viewport for that content
- **THEN** the panel header and fixed controls remain visible outside the scrolling region

#### Scenario: Nested wrappers do not compete for scrolling
- **WHEN** the panel is composed from shell, async, and content wrappers
- **THEN** only the designated primary scroll viewport owns scrolling for the main content area
- **THEN** ancestor layout wrappers do not introduce competing hidden or auto overflow behavior

#### Scenario: Removing clipping restores explicit scrolling
- **WHEN** a layout wrapper stops using raw clipping in order to follow the overflow contract
- **THEN** the surface reassigns scrolling to an explicit `ScrollView` where needed
- **THEN** long Chat, Devtools, Cycles, and Settings content remains scrollable on desktop and compact viewports

#### Scenario: Scaffold owns fixed-vs-stretch structure
- **WHEN** a page surface or dialog needs fixed chrome plus one scrolling body
- **THEN** it uses a shared scaffold primitive to declare the fixed and stretch regions
- **THEN** feature code does not rebuild the same shell contract with ad hoc `grid/flex + h-full + minmax(0,1fr)` composition

#### Scenario: Shared scaffold slots retain their row ownership when optional regions are omitted
- **WHEN** a scaffold-family surface omits its header or footer region
- **THEN** `Body` or `ScrollBody` still binds to the dedicated stretch row instead of auto-flowing into the first available row
- **THEN** transcript, terminal, and dialog stages keep their dominant viewport height without local `min-h-0` rescue patches

#### Scenario: Shared sidebar scaffold does not depend on consumer Tailwind generation
- **WHEN** a consumer route imports `SidebarScaffold` from `@agenter/svelte-components`
- **THEN** the responsive column and row law is owned by package-local CSS/media rules
- **THEN** first-level routes do not silently collapse into one stacked column because the consuming app failed to generate a shared utility class
