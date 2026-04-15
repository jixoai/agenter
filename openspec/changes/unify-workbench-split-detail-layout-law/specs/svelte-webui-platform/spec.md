## ADDED Requirements

### Requirement: Workbench routes SHALL derive right-detail compact fallback from container width
Workbench routes that expose a persistent `main + right detail` relationship SHALL derive compact fallback from the split container width and the shared split-detail minimum-width law rather than from route-local viewport breakpoints. Routes SHALL consume the shared structural primitive instead of reimplementing `detailMode + Sheet` state.

#### Scenario: Narrow page-content collapses secondary detail first
- **WHEN** a workbench route with shared split-detail layout becomes narrower than its configured split minimums
- **THEN** the route keeps the primary left task surface visible
- **THEN** the right detail collapses through the shared compact-detail path instead of squeezing the primary surface past usability

#### Scenario: Wide page-content keeps the shared desktop split
- **WHEN** the route has enough page-content width to satisfy the configured split minimums
- **THEN** the route renders the persistent desktop split through the shared structural primitive
- **THEN** the route does not rely on a page-local media-query toggle to decide whether detail is split or sheet-based

### Requirement: Compact right detail SHALL keep page-toolbar responsibility limited to view control
When a workbench route opens compact right detail, the shared `page-toolbar` SHALL temporarily provide a close-only affordance for that view transition. The toolbar SHALL NOT become the container for detail-local functional actions while the compact detail sheet is open.

#### Scenario: Compact detail replaces toolbar content with close-only affordance
- **WHEN** a compact workbench route opens its shared right-detail sheet
- **THEN** the toolbar chrome switches from normal route-local content to a close-only affordance
- **THEN** the route keeps close ownership in the toolbar position without inventing a second local header

#### Scenario: Detail-local actions remain in page content
- **WHEN** a route exposes detail-local actions such as save, reload, apply, or create
- **THEN** those actions remain in the route body surface rather than moving into the toolbar during compact detail mode
- **THEN** toolbar chrome remains dedicated to identity, view switching, and view visibility control
