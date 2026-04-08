## MODIFIED Requirements

### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to ScrollView
User-facing frontend surfaces SHALL use a shared `ScrollView` primitive for any scrolling surface, and feature code or shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities. The durable Svelte `ScrollView` primitive SHALL be published from `@agenter/svelte-components`.

#### Scenario: Shared Svelte package consumes ScrollView
- **WHEN** a shared Svelte package needs a durable scroll owner
- **THEN** it imports `ScrollView` from `@agenter/svelte-components`
- **THEN** host packages do not need a product-local wrapper to recover the shared scroll law
