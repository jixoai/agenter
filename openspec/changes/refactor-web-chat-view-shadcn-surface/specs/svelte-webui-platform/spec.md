## ADDED Requirements

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
