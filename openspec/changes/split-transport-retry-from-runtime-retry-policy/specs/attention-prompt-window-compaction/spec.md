## ADDED Requirements

### Requirement: Compact trigger law SHALL resolve from explicit compact policy

The runtime SHALL resolve automatic compact triggers from an explicit compact-policy contract instead of using a generic any-error fallback or inferring compact law from provider metadata.

#### Scenario: Timeout does not trigger compact by default

- **WHEN** a model round fails with a timeout and the compact policy does not explicitly enable timeout-triggered compact
- **THEN** the runtime records the timeout failure as recovery state
- **AND** it does not enqueue a compact cycle just because an error occurred

#### Scenario: Context overflow triggers compact through explicit recovery policy

- **WHEN** a model round fails with context overflow and the compact policy enables `context_overflow`
- **THEN** the runtime enqueues a compact cycle with the `context_overflow` trigger
- **AND** the resulting cycle is distinguishable from threshold, manual, and other recovery-driven compact cycles

### Requirement: Threshold compact SHALL belong to runtime compact policy

Prompt-window threshold compaction SHALL be configured through the runtime compact policy instead of provider metadata, while still allowing a legacy read path during migration.

#### Scenario: Legacy provider compact threshold migrates into runtime compact policy

- **WHEN** settings still define a legacy provider `compactThreshold` without an explicit runtime compact policy threshold
- **THEN** resolved runtime config uses that legacy value as a compatibility fallback
- **AND** new writes continue to target the runtime compact policy instead of provider settings
