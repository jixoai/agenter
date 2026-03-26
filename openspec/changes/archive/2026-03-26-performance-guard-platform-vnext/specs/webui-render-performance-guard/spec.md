## ADDED Requirements

### Requirement: Heavy structured viewers SHALL preserve stable renderer identity
The WebUI SHALL keep heavy structured viewers and editor-like renderers stable when unrelated runtime facts change.

#### Scenario: Unrelated runtime updates do not remount a structured viewer
- **WHEN** a rendered Markdown, JSON, YAML, or comparable structured viewer row receives unrelated runtime updates that do not change its content
- **THEN** the viewer keeps a stable React-facing identity
- **THEN** the route does not recreate the underlying heavy renderer for that row

### Requirement: Technical long-list routes SHALL use shared bounded list primitives
Technical long-list routes SHALL render through shared virtualized list and bounded-window primitives instead of bespoke full-history list composition.

#### Scenario: Technical panels reuse the shared long-list contract
- **WHEN** a user opens Cycles, Terminal Activity, Model history, or similar technical long-list routes
- **THEN** those routes hydrate only the recent shared window and page older rows on demand
- **THEN** they render through the shared virtualized list contract with one deliberate scroll owner
