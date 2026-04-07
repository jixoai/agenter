## ADDED Requirements

### Requirement: ScrollView virtual contracts SHALL remain aligned with the installed TanStack virtualizer types
The shared `ScrollView` primitive SHALL derive its virtual-mode type surface from the installed `@tanstack/svelte-virtual` package instead of maintaining stale local type assumptions that can drift from the dependency.

#### Scenario: Shared package typechecks after dependency evolution
- **WHEN** the installed TanStack virtualizer package changes exported helper types or callback instance shapes
- **THEN** `@agenter/svelte-components` still typechecks by deriving its public virtual-mode contract from the dependency's durable exported structures
- **THEN** downstream Svelte consumers such as `@agenter/webui` do not fail typecheck because `ScrollView` shadowed an outdated callback or key type

#### Scenario: Virtual rows render from non-null normalized data
- **WHEN** `ScrollView` renders virtual items in Svelte templates
- **THEN** the component normalizes nullable lookup results before template rendering
- **THEN** the template iterates concrete row records instead of re-proving nullability at render sites
