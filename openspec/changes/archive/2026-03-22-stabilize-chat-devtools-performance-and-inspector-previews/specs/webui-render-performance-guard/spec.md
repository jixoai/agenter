## MODIFIED Requirements

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
