# webui-render-performance-guard Specification

## Purpose
TBD - created by archiving change analyze-webui-performance-trace. Update Purpose after archive.
## Requirements
### Requirement: Workspace shell chrome SHALL avoid avoidable callback-identity churn
The WebUI SHALL keep workspace shell chrome components such as the global header, workspace header, workspace tab chrome, and bottom navigation free from avoidable callback and item-array churn during routine runtime updates.

#### Scenario: Runtime updates do not force shell chrome callback churn
- **WHEN** runtime events update active session data without changing the visible shell route structure
- **THEN** shell chrome does not recreate navigation callbacks or tab item arrays unless the underlying navigation target or visible route state changed
- **THEN** shell chrome remains eligible for memoized rendering boundaries

### Requirement: Profiling-backed hotspots SHALL be regression-tested through observable behavior
The WebUI SHALL keep regression coverage for the behavior surfaces that were identified through the exported browser trace instead of relying on manual CPU complaints alone.

#### Scenario: Long-history Chat and Devtools timeline remain operable
- **WHEN** the browser opens a persisted long-history workspace session
- **THEN** the Chat route restores the latest visible conversation turn inside one deliberate scroll viewport
- **THEN** the Devtools cycle timeline also exposes a scrollable primary viewport without losing its fixed route chrome

#### Scenario: Unrelated runtime updates do not remount stable transcript rows
- **WHEN** hot runtime activity updates the active session without changing an already rendered Chat row's content
- **THEN** the Chat row keeps a stable React-facing identity for that row
- **THEN** its read-only markdown surface does not need to be recreated just to reflect unrelated runtime facts

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

