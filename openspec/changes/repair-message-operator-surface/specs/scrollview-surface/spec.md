## MODIFIED Requirements

### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to ScrollView
User-facing frontend surfaces SHALL use a shared `ScrollView` primitive for any scrolling surface, and feature code or shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities.

#### Scenario: Vertical system transcript
- **WHEN** a system transcript needs vertical scrolling
- **THEN** the feature composes a `ScrollView` rather than applying raw scroll CSS directly

#### Scenario: Horizontal code or JSON preview
- **WHEN** a technical preview needs horizontal scrolling
- **THEN** the preview still uses `ScrollView` ownership instead of inline raw overflow utilities

#### Scenario: Shared web component transcript
- **WHEN** a reusable chat or operator component owns a stretchable transcript viewport
- **THEN** that component still uses the shared `ScrollView` contract internally
- **THEN** host applications do not reintroduce raw overflow to recover scrolling
