# scrollview-surface Specification

## Purpose
TBD - created by archiving change codify-scrollview-law-and-svelte-shell-primitives. Update Purpose after archive.
## Requirements
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

#### Scenario: Dialog management shell uses one detail scroll owner
- **WHEN** a dialog contains a sidebar rail plus a stretchable detail stage
- **THEN** the rail and detail stage each keep explicit scroll ownership boundaries
- **THEN** the detail stage delegates its long content to one `ScrollView` instead of mixing multiple competing scroll containers

#### Scenario: Runtime shell uses explicit primary and secondary scroll owners
- **WHEN** a runtime page contains a primary stage and a secondary facts rail
- **THEN** each stretchable column uses one explicit `ScrollView` owner
- **THEN** outer layout wrappers remain responsible only for sizing and placement

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

