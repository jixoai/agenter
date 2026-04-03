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

#### Scenario: Dialog management shell uses one detail scroll owner
- **WHEN** a dialog contains a sidebar rail plus a stretchable detail stage
- **THEN** the rail and detail stage each keep explicit scroll ownership boundaries
- **THEN** the detail stage delegates its long content to one `ScrollView` instead of mixing multiple competing scroll containers

#### Scenario: Runtime shell uses explicit primary and secondary scroll owners
- **WHEN** a runtime page contains a primary stage and a secondary facts rail
- **THEN** each stretchable column uses one explicit `ScrollView` owner
- **THEN** outer layout wrappers remain responsible only for sizing and placement
