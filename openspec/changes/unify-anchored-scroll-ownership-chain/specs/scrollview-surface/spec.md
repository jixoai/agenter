## MODIFIED Requirements

### Requirement: Frontend feature surfaces SHALL delegate scroll ownership to shared scroll primitives

User-facing frontend surfaces SHALL delegate scroll ownership to shared scroll primitives instead of route-local raw overflow ownership. Standard scrolling panels SHALL use `ScrollView`, while WebChat-like anchored virtual long lists SHALL use the dedicated anchored virtual list scroll contract. Each shared scroll primitive SHALL keep one effective scroll writer per viewport, even when virtualization, insert motion, or reconciliation are involved. Feature code and shared reusable surface packages SHALL NOT directly own scrolling with raw `overflow-auto`, `overflow-scroll`, or equivalent utilities, and they SHALL NOT layer additional viewport writers on top of the shared primitive.

#### Scenario: Vertical system transcript

- **WHEN** a system transcript needs vertical scrolling without anchored latest-edge semantics
- **THEN** the feature composes a `ScrollView` rather than applying raw scroll CSS directly

#### Scenario: Shared web component transcript

- **WHEN** a reusable chat or operator component owns a stretchable transcript viewport
- **THEN** that component uses the shared anchored virtual list scroll law for transcript ownership
- **AND** host applications do not reintroduce raw overflow or route-local scroll math to recover scrolling

#### Scenario: Insert motion does not create a second writer

- **WHEN** a shared transcript surface applies insert motion or virtualization-driven reconciliation
- **THEN** the shared scroll primitive remains the only effective viewport writer
- **AND** animation or measurement helpers do not mutate the viewport independently
