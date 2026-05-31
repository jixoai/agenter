## MODIFIED Requirements

### Requirement: Svelte WebUI SHALL place primary and secondary content through responsive shells
The active Svelte WebUI SHALL model primary content, navigation, secondary context, and parallel tools through explicit responsive shells. Compact layouts SHALL collapse secondary content into `left-sidebar`, `right-sidebar`, `bottom-sheet`, `Dialog`, or `tabs`, while larger layouts MAY reveal those same surfaces by default without changing the primary task hierarchy. Shared structural shells such as `ScrollView`, `Scaffold`, `DialogScaffold`, and `SidebarScaffold` SHALL be consumed from `@agenter/svelte-components`, while shared workbench split-detail visibility host logic SHALL remain in the WebUI navigation layer instead of being reimplemented route-by-route.

#### Scenario: Compact route collapses secondary content first
- **WHEN** the viewport becomes constrained
- **THEN** the route keeps the primary task surface visible
- **THEN** secondary navigation or management content collapses into dedicated responsive shells before the primary stage is compressed beyond usability

#### Scenario: Desktop route expands secondary context without changing task priority
- **WHEN** the viewport becomes wider
- **THEN** the route may reveal sidebars or secondary panes by default
- **THEN** those expanded surfaces remain visually and structurally secondary to the primary task stage

#### Scenario: WebUI route consumes shared structural package
- **WHEN** a WebUI route or shell needs scrolling or scaffold-family layout
- **THEN** it composes the shared primitives from `@agenter/svelte-components`
- **THEN** `@agenter/webui` stays a app assembly layer instead of becoming the source of truth for shared layout law

### Requirement: Workbench routes SHALL derive right-detail compact fallback from container width
Workbench routes that expose a persistent `main + right detail` relationship SHALL derive compact fallback from the split container width and the shared split-detail minimum-width law rather than from route-local viewport breakpoints. Routes SHALL consume the shared split-detail geometry primitive plus the shared WebUI visibility host instead of reimplementing `detailMode + Sheet` state or desktop detail visibility locally.

#### Scenario: Narrow page-content collapses secondary detail first
- **WHEN** a workbench route with shared split-detail layout becomes narrower than its configured split minimums
- **THEN** the route keeps the primary left task surface visible
- **THEN** the right detail collapses through the shared compact-detail path instead of squeezing the primary surface past usability

#### Scenario: Wide page-content keeps the shared desktop split
- **WHEN** the route has enough page-content width to satisfy the configured split minimums
- **THEN** the route renders the persistent desktop split through the shared structural primitive
- **THEN** the route does not rely on a page-local media-query toggle to decide whether detail is split or sheet-based

#### Scenario: Desktop routes reuse shared detail visibility instead of route-local hacks
- **WHEN** a workbench route hides or reopens its desktop right detail surface
- **THEN** it does so through the shared split-detail visibility host
- **THEN** the route does not rebuild a second desktop-only detail visibility contract in feature code

## ADDED Requirements

### Requirement: Static sidebar shells SHALL use SidebarScaffold
WebUI routes, dialogs, and shared package demos that need a static `sidebar + content` shell SHALL use `SidebarScaffold`. They SHALL NOT keep or reintroduce `SplitView` after the migration lands.

#### Scenario: Static settings or management shell uses the shared sidebar scaffold
- **WHEN** a route or dialog needs a persistent static sidebar beside a content stage
- **THEN** it composes `SidebarScaffold.Root`, `SidebarScaffold.Sidebar`, and `SidebarScaffold.Content`
- **THEN** it does not import `SplitView`
