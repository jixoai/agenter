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
The top-level WebUI shell SHALL organize navigation around orthogonal systems, not around the old session-first route hierarchy. The active Svelte shell SHALL expose primary routes for `Workspaces`, `History`, `Messages`, `Terminals`, and `Settings`, and it SHALL also expose a secondary `Running Avatars` rail that opens the running-avatar detail shell without mutating the primary destination set.

#### Scenario: Primary navigation
- **WHEN** the operator opens the WebUI
- **THEN** the primary shell exposes dedicated entry points for workspaces, message-system, terminal-system, history, and global settings/profile

#### Scenario: Secondary runtime navigation
- **WHEN** one or more avatars are running
- **THEN** the shell exposes them in a dedicated `Running Avatars` section outside the primary destination set
- **THEN** activating one of those entries opens the running-avatar detail shell instead of changing the primary navigation model

#### Scenario: Route ownership
- **WHEN** a system surface or running-avatar detail surface is rendered
- **THEN** its route layout owns local navigation and state without depending on React-era shell contracts

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
The active Svelte WebUI SHALL model primary content, navigation, secondary context, and parallel tools through explicit responsive shells. Compact layouts SHALL collapse secondary content into `left-sidebar`, `right-sidebar`, `bottom-sheet`, `Dialog`, or `tabs`, while larger layouts MAY reveal those same surfaces by default without changing the primary task hierarchy.

#### Scenario: Compact route collapses secondary content first
- **WHEN** the viewport becomes constrained
- **THEN** the route keeps the primary task surface visible
- **THEN** secondary navigation or management content collapses into dedicated responsive shells before the primary stage is compressed beyond usability

#### Scenario: Desktop route expands secondary context without changing task priority
- **WHEN** the viewport becomes wider
- **THEN** the route may reveal sidebars or secondary panes by default
- **THEN** those expanded surfaces remain visually and structurally secondary to the primary task stage
