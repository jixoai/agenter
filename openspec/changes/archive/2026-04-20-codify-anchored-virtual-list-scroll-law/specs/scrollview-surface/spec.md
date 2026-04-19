## MODIFIED Requirements

### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to ScrollView

User-facing frontend surfaces SHALL delegate scroll ownership to shared scroll primitives instead of route-local raw overflow ownership. Standard scrolling panels SHALL use `ScrollView`, while WebChat-like anchored virtual long lists SHALL use the dedicated anchored virtual list scroll contract. Feature code and shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities. Stretchable regions that host these shared scroll primitives SHALL be created through the shared scaffold-family primitives rather than page-local shell classes.

#### Scenario: Vertical system transcript

- **WHEN** a system transcript needs vertical scrolling without anchored latest-edge semantics
- **THEN** the feature composes a `ScrollView` rather than applying raw scroll CSS directly

#### Scenario: Horizontal code or JSON preview

- **WHEN** a technical preview needs horizontal scrolling
- **THEN** the preview still uses `ScrollView` ownership instead of inline raw overflow utilities

#### Scenario: Shared web component transcript

- **WHEN** a reusable chat or operator component owns a stretchable transcript viewport
- **THEN** that component uses the shared anchored virtual list scroll law for transcript ownership
- **THEN** host applications do not reintroduce raw overflow or route-local scroll math to recover scrolling

#### Scenario: Dialog management shell uses one detail scroll owner

- **WHEN** a dialog contains a sidebar rail plus a stretchable detail stage
- **THEN** the rail and detail stage each keep explicit scroll ownership boundaries
- **THEN** the detail stage delegates its long content to one shared scroll primitive instead of mixing multiple competing scroll containers

#### Scenario: Scaffold-owned route body hosts the only scroll primitive

- **WHEN** a route panel or dialog body needs vertical scrolling
- **THEN** the surface creates that stretch region through `Scaffold.ScrollBody` or `DialogScaffold.ScrollBody`
- **THEN** a shared scroll primitive remains the only scroll owner inside that region

#### Scenario: Shared Svelte package consumes shared scroll law

- **WHEN** a shared Svelte package needs durable scroll ownership
- **THEN** it imports the appropriate shared scroll primitive from `@agenter/svelte-components`
- **THEN** host packages do not need a product-local wrapper to recover the scroll law
