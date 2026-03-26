# runtime-performance-diagnostics Specification

## Purpose
TBD - created by archiving change performance-guard-platform-vnext. Update Purpose after archive.
## Requirements
### Requirement: Performance diagnostics SHALL expose shared runtime and UI counters
The system SHALL provide one shared diagnostics surface for performance investigation so publication churn, hydration growth, and memory-sensitive routes can be inspected without bespoke instrumentation per panel.

#### Scenario: Diagnostics expose hot publication and hydration counters
- **WHEN** a developer inspects performance diagnostics for an active session or route
- **THEN** the system reports publication counts, active subscription counts, and hydrated page-window statistics for the relevant runtime resources
- **THEN** those counters come from shared diagnostics primitives rather than panel-specific custom code

#### Scenario: Diagnostics do not alter production behavior
- **WHEN** diagnostics are enabled for investigation
- **THEN** the observed runtime and UI behavior remains semantically identical to the normal product flow
- **THEN** diagnostics add only the lightweight counters and evidence needed for inspection

### Requirement: Performance regression workflow SHALL produce reproducible evidence
The repository SHALL define one shared workflow for capturing browser-level performance evidence across supported viewports.

#### Scenario: Desktop and mobile walkthroughs share one evidence contract
- **WHEN** a developer runs the standard browser performance walkthrough
- **THEN** the workflow captures evidence for both desktop and iPhone 14 viewports
- **THEN** the resulting evidence can be compared against the same route and interaction checkpoints in later regressions

