# svelte-webui-platform Specification

## Purpose
Define the active SvelteKit-based operator WebUI platform, including system-first navigation and the durable shell responsibilities that replace the archived React implementation.
## Requirements
### Requirement: SvelteKit package SHALL be the active WebUI platform
The repository SHALL expose `@agenter/webui` as a SvelteKit 2 + Svelte 5 package, and the previous React implementation SHALL be retained only as an inactive reference package.

#### Scenario: Active package resolution
- **WHEN** workspace package discovery resolves `@agenter/webui`
- **THEN** it resolves to the SvelteKit package rather than the archived React package

#### Scenario: Archived React package remains available
- **WHEN** engineers need implementation reference from the previous UI
- **THEN** the React package remains available under a non-conflicting package identity

### Requirement: CLI delivery SHALL serve the SvelteKit app as static SPA assets
The CLI WebUI delivery path SHALL continue serving copied static assets, and unknown non-asset paths SHALL resolve to the SvelteKit SPA fallback page.

#### Scenario: Root page request
- **WHEN** `agenter web` serves `/`
- **THEN** the CLI returns the static WebUI entry document

#### Scenario: Nested route refresh
- **WHEN** a browser refreshes a client route such as `/messages/room-ops`
- **THEN** the CLI returns the SPA fallback document instead of a 404

### Requirement: The platform SHALL expose system-first navigation
The top-level WebUI shell SHALL expose only `Avatars`, `Messages`, and `Terminals` as primary destinations. The shell SHALL expose `/admin` only through the footer superadmin affordance, and running avatars SHALL appear as dynamic tabs inside the Avatars workbench instead of a separate primary destination, global top bar, or secondary rail card. The shell SHALL NOT inject a redundant top header or refresh-only control above the currently selected workbench window.

#### Scenario: Primary shell exposes exactly three destinations
- **WHEN** the operator opens the WebUI
- **THEN** the left primary navigation shows only `Avatars`, `Messages`, and `Terminals`
- **THEN** neither global settings nor running avatars are promoted into that primary destination set

#### Scenario: Superadmin uses the footer auxiliary route
- **WHEN** the operator needs global administration
- **THEN** they enter `/admin` from the footer superadmin affordance
- **THEN** the application does not add a fourth primary destination for that workflow

#### Scenario: Auth bootstrap helper does not become a destination card
- **WHEN** the operator has not yet bound a root key
- **THEN** the shell keeps the helper state inside the auxiliary superadmin affordance
- **THEN** the shell does not render an extra auth/bootstrap card in the main navigation surface

#### Scenario: Selected workbench owns local chrome
- **WHEN** the operator switches to a primary destination
- **THEN** the selected workbench renders its own title, metadata, and local actions inside its window chrome
- **THEN** there is no redundant global top bar or manual refresh button rendered above that workbench

#### Scenario: Compact workbench tabs do not widen the page
- **WHEN** the operator opens a multi-tab workbench on an iPhone 14-sized viewport
- **THEN** horizontal tab overflow stays inside the shared tab-strip scroller
- **THEN** `document.body` width remains constrained to the viewport instead of expanding to the tab content width

### Requirement: Workbench routes SHALL provide objective workspace path presentation
Workspace-aware workbench surfaces SHALL present the global workspace as `~/.agenter`, SHALL use compact objective labels for dense navigation surfaces, and SHALL use the full objective path for detail titles. Compact workspace labels in tabs, rails, and summary chrome SHALL use the final two path segments when more than two segments exist.

#### Scenario: Global workspace uses the objective home-relative form
- **WHEN** a workspace-aware surface renders the special global workspace rooted at `~/`
- **THEN** the visible label is `~/.agenter`
- **THEN** the UI does not replace that objective path with subjective titles such as `Global workspace`

#### Scenario: Dense navigation uses compact objective paths
- **WHEN** a workbench list or tab renders a regular workspace path such as `/Users/kzf/Dev/GitHub/jixoai-labs/agenter`
- **THEN** the dense navigation label is shown as `jixoai-labs/agenter`
- **THEN** the detail title for the selected workspace still uses the full objective path

### Requirement: Workbench window chrome SHALL expose shared sidebar visibility control
Each selected primary workbench window SHALL expose a local sidebar visibility control through shared workbench chrome so desktop and compact operators can collapse or expand the left shell without reintroducing a global shell header.

#### Scenario: Desktop workbench can collapse the application sidebar
- **WHEN** the operator is viewing a primary workbench on a desktop-sized viewport
- **THEN** the workbench chrome exposes a sidebar collapse control
- **THEN** activating that control toggles the left application shell without depending on a separate global header

#### Scenario: Compact workbench still exposes the navigation trigger
- **WHEN** the operator is viewing a primary workbench on a compact viewport
- **THEN** the workbench chrome exposes the same shared navigation trigger
- **THEN** the operator can reopen the shell without leaving the current workbench

### Requirement: Svelte WebUI SHALL use canonical shadcn-svelte multipart composition
The active Svelte WebUI SHALL consume multipart shadcn-svelte primitives through their canonical composition model rather than through alias-style wrappers that mimic a different framework. Shared UI exports MAY centralize imports, but feature code MUST compose multipart primitives through `Root`, `Header`, `Content`, `List`, `Trigger`, and similar explicit slots.

#### Scenario: Feature route uses Card through canonical slots
- **WHEN** a feature route needs a card-like surface
- **THEN** it composes the multipart primitive through canonical slot exports such as `Card.Root` and `Card.Header`
- **THEN** the route does not depend on alias components such as `CardHeader` that obscure the multipart contract

#### Scenario: Tabs stay explicit in feature code
- **WHEN** a feature route uses tabs
- **THEN** it composes them through canonical `Tabs.Root/List/Trigger/Content` structure
- **THEN** responsive layout decisions remain visible in the route structure instead of being hidden behind alias wrappers

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

### Requirement: Compact workbench tabs SHALL preserve the primary running-tab hit target
The shared workbench tab strip SHALL keep the primary tab trigger as the dominant tap target on compact mobile-sized containers. Secondary inline actions such as tab menu or close affordances SHALL NOT cover the running tab label or center hit area when the strip becomes narrow.

#### Scenario: Mobile running tab remains selectable
- **WHEN** the operator opens a workbench with running tabs on an iPhone 14-sized viewport
- **THEN** tapping a visible running tab selects that tab instead of activating an overlaid secondary action
- **THEN** the tab strip keeps its interaction inside shared workbench chrome without requiring a page-specific workaround

#### Scenario: Narrow workbench strips collapse inline tab actions
- **WHEN** the shared tab strip renders inside a narrow container
- **THEN** inline close/menu overlay buttons collapse out of the compact tab chrome
- **THEN** the tab trigger padding contracts back so the visible label keeps the primary hit target

### Requirement: Compact app shell SHALL keep the left window-switcher rail visible
The top-level WebUI shell SHALL keep the left application sidebar visible on compact viewports as the persistent window switcher. Compact layouts MAY collapse that rail to icon width, but SHALL NOT hide primary navigation behind a drawer or page-local reopen control.

#### Scenario: Mobile shell keeps the window switcher visible
- **WHEN** the operator opens the WebUI on an iPhone 14-sized viewport
- **THEN** the left rail still renders the primary `Avatars`, `Messages`, and `Terminals` navigation surface
- **THEN** the shell does not require a page-local toolbar button to reopen primary navigation

#### Scenario: Compact rail can expand from sidebar chrome
- **WHEN** the compact app shell starts in collapsed icon mode
- **THEN** the operator can expand or collapse the same left rail from controls inside sidebar chrome
- **THEN** the current workbench window stays responsible only for page-local chrome

