# scrollview-surface Specification

## Purpose
Define the shared scroll ownership contract for standard surfaces and the boundary between `ScrollView` and the dedicated anchored virtual list runtime.
## Requirements
### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to shared scroll primitives
User-facing frontend surfaces SHALL delegate scroll ownership to shared scroll primitives instead of route-local raw overflow ownership. Standard scrolling panels SHALL use `ScrollView`, while WebChat-like anchored virtual long lists SHALL use the dedicated anchored virtual list scroll contract. Each shared scroll primitive SHALL keep one effective scroll writer per viewport, even when virtualization, insert motion, or reconciliation are involved. Feature code and shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities, and they SHALL NOT layer additional viewport writers on top of the shared primitive. Stretchable regions that host these shared scroll primitives SHALL be created through the shared scaffold-family primitives rather than page-local shell classes.

#### Scenario: Vertical system transcript
- **WHEN** a system transcript needs vertical scrolling without anchored latest-edge semantics
- **THEN** the feature composes a `ScrollView` rather than applying raw scroll CSS directly

#### Scenario: Horizontal code or JSON preview
- **WHEN** a technical preview needs horizontal scrolling
- **THEN** the preview still uses `ScrollView` ownership instead of inline raw overflow utilities

#### Scenario: Shared web component transcript
- **WHEN** a reusable chat or operator component owns a stretchable transcript viewport
- **THEN** that component uses the shared anchored virtual list scroll law for transcript ownership
- **AND** host applications do not reintroduce raw overflow or route-local scroll math to recover scrolling

#### Scenario: Dialog management shell uses one detail scroll owner
- **WHEN** a dialog contains a sidebar rail plus a stretchable detail stage
- **THEN** the rail and detail stage each keep explicit scroll ownership boundaries
- **THEN** the detail stage delegates its long content to one `ScrollView` instead of mixing multiple competing scroll containers

#### Scenario: Scaffold-owned route body hosts the only scroll primitive
- **WHEN** a route panel or dialog body needs vertical scrolling
- **THEN** the surface creates that stretch region through `Scaffold.ScrollBody` or `DialogScaffold.ScrollBody`
- **THEN** a shared scroll primitive remains the only scroll owner inside that region

#### Scenario: Shared Svelte package consumes shared scroll law
- **WHEN** a shared Svelte package needs durable scroll ownership
- **THEN** it imports the appropriate shared scroll primitive from `@agenter/svelte-components`
- **THEN** host packages do not need a app-local wrapper to recover the shared scroll law

#### Scenario: Insert motion does not create a second writer
- **WHEN** a shared transcript surface applies insert motion or virtualization-driven reconciliation
- **THEN** the shared scroll primitive remains the only effective viewport writer
- **AND** animation or measurement helpers do not mutate the viewport independently

### Requirement: ScrollView SHALL support static and virtual rendering
The shared scrolling primitive SHALL support plain content scrolling and item virtualization through one durable component contract.

#### Scenario: Static panel content
- **WHEN** a dialog body or settings panel uses `ScrollView` in static mode
- **THEN** the full content is rendered inside one owned scroll surface

#### Scenario: Large transcript list
- **WHEN** a long transcript or activity feed opts into virtual mode
- **THEN** `ScrollView` renders only the visible window while preserving one scroll owner and stable item keys

### Requirement: Raw overflow exceptions SHALL be explicit and internal
If raw overflow behavior remains necessary for implementation details, the exception SHALL live inside a shared primitive or documented animation mask, not in feature code.

#### Scenario: Internal animation mask
- **WHEN** an accordion or transition mask needs clipping
- **THEN** the implementation may keep internal overflow behavior without exposing raw scroll ownership to the feature layer

#### Scenario: Static analysis review
- **WHEN** new feature code introduces raw `overflow-*` scroll ownership
- **THEN** verification flags it as a contract violation

### Requirement: ScrollView virtual contracts SHALL remain aligned with the installed TanStack virtualizer types
The shared `ScrollView` primitive SHALL derive its virtual-mode type surface from the installed `@tanstack/svelte-virtual` package instead of maintaining stale local type assumptions that can drift from the dependency.

#### Scenario: Shared package typechecks after dependency evolution
- **WHEN** the installed TanStack virtualizer package changes exported helper types or callback instance shapes
- **THEN** `@agenter/svelte-components` still typechecks by deriving its public virtual-mode contract from the dependency's durable exported structures
- **THEN** downstream Svelte consumers such as `agenter-app-studio` do not fail typecheck because `ScrollView` shadowed an outdated callback or key type

#### Scenario: Virtual rows render from non-null normalized data
- **WHEN** `ScrollView` renders virtual items in Svelte templates
- **THEN** the component normalizes nullable lookup results before template rendering
- **THEN** the template iterates concrete row records instead of re-proving nullability at render sites

### Requirement: ScrollView virtual consumers SHALL preserve bottom anchors during measured growth
The shared `ScrollView` contract SHALL expose the virtualizer hooks needed by bottom-anchored consumers to keep the latest visible rows in view when a new measured item appears or when the last mounted item changes size after async disclosure or remeasurement.

#### Scenario: Appending a measured latest row keeps the bottom anchor
- **WHEN** a virtualized conversation is already pinned to the bottom
- **AND** a new latest row is appended and measured
- **THEN** the viewport remains anchored to the latest visible rows
- **AND** the consumer does not need a route-local second scroll container to recover the latest content

#### Scenario: Growing the last mounted row keeps the bottom anchor
- **WHEN** the last visible virtual row grows because more content becomes measurable after mount
- **THEN** the shared virtual scroll contract adjusts the viewport in place
- **AND** the latest visible rows remain reachable without manual operator scrolling
