## ADDED Requirements

### Requirement: Sidebar scaffold SHALL provide the shared static `sidebar + content` shell
The system SHALL provide a dedicated `SidebarScaffold` primitive for static `sidebar + content` shells. That primitive SHALL own its responsive stacking and desktop column law inside package-local CSS, and it SHALL NOT expose pseudo detail semantics or multi-variant split behavior.

#### Scenario: Compact sidebar scaffold stacks navigation above content
- **WHEN** a consumer renders `SidebarScaffold` inside a narrow container
- **THEN** the sidebar region stacks before the content region
- **THEN** the consumer does not need route-local breakpoint classes to recover the shared shell

#### Scenario: Desktop sidebar scaffold reveals the persistent sidebar column
- **WHEN** a consumer renders `SidebarScaffold` inside a wide container
- **THEN** the scaffold reveals the shared persistent sidebar column beside content
- **THEN** the layout remains a static `sidebar + content` shell rather than a stateful main-detail surface

### Requirement: Sidebar scaffold SHALL replace SplitView as the durable static shell law
The repository SHALL use `SidebarScaffold` as the only active shared primitive for static `sidebar + content` shells. App code, stories, tests, and durable docs SHALL NOT depend on `SplitView` once migration is complete.

#### Scenario: Shared consumer imports the static shell after migration
- **WHEN** a WebUI route or shared package needs a static sidebar shell
- **THEN** it imports `SidebarScaffold` from `@agenter/svelte-components`
- **THEN** it does not import or reference `SplitView`
