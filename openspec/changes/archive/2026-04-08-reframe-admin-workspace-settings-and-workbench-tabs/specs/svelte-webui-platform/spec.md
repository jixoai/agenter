## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation
The top-level WebUI shell SHALL organize navigation around orthogonal systems, not around the old session-first route hierarchy. The active Svelte shell SHALL expose primary routes for `Avatars`, `Messages`, and `Terminals`, and it SHALL expose `/admin` only as an auxiliary footer-entry route for superadmin/profile management rather than as a primary destination.

#### Scenario: Primary navigation
- **WHEN** the operator opens the WebUI
- **THEN** the primary shell exposes dedicated entry points for `Avatars`, `Messages`, and `Terminals`
- **THEN** `admin` is not promoted into the primary destination set

#### Scenario: Footer administration entry
- **WHEN** the operator activates the footer `super admin` affordance
- **THEN** the application navigates to `/admin`
- **THEN** the primary navigation model remains unchanged

#### Scenario: Route ownership
- **WHEN** a system surface, auxiliary admin surface, or running-avatar detail surface is rendered
- **THEN** its route layout owns local navigation and state without depending on React-era shell contracts

### Requirement: Svelte WebUI SHALL place primary and secondary content through responsive shells
The active Svelte WebUI SHALL model primary content, navigation, secondary context, and parallel tools through explicit responsive shells. Compact layouts SHALL collapse secondary content into `left-sidebar`, `right-sidebar`, `bottom-sheet`, `Dialog`, or `tabs`, while larger layouts MAY reveal those same surfaces by default without changing the primary task hierarchy. Shared structural shells such as `ScrollView`, `Scaffold`, `DialogScaffold`, and `SplitView` SHALL be consumed from `@agenter/svelte-components` rather than being implemented inside `@agenter/webui`.

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
- **THEN** `@agenter/webui` stays a product assembly layer instead of becoming the source of truth for shared layout law
