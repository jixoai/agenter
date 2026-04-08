## MODIFIED Requirements

### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to ScrollView
User-facing frontend surfaces SHALL use a shared `ScrollView` primitive for any scrolling surface, and feature code or shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities. Stretchable regions that host `ScrollView` SHALL be created through the shared scaffold-family primitives rather than page-local shell classes.

#### Scenario: Scaffold scroll body hosts the only scroll primitive
- **WHEN** a route panel or dialog body needs vertical scrolling
- **THEN** the surface creates that stretch region through `Scaffold.ScrollBody` or `DialogScaffold.ScrollBody`
- **THEN** `ScrollView` remains the only scroll owner inside that region
