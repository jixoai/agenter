## ADDED Requirements

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
