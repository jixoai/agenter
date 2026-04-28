## ADDED Requirements

### Requirement: Runtime retry policy SHALL be a durable structured contract

The system SHALL resolve runtime recovery and backoff behavior from a durable structured retry-policy contract instead of inferring that behavior from provider transport retry settings or frontend heuristics.

#### Scenario: Settings define an explicit runtime retry policy

- **WHEN** settings provide a runtime retry policy for the session scheduler
- **THEN** resolved runtime config includes that structured policy as objective runtime truth
- **AND** downstream runtime components do not need to guess the backoff law from unrelated provider metadata

#### Scenario: Missing policy falls back to a canonical default

- **WHEN** settings omit an explicit runtime retry policy
- **THEN** the system resolves a canonical default retry policy
- **AND** the runtime can publish that default as the effective recovery law instead of relying on hidden constants

### Requirement: Runtime retry policy SHALL define progression and reset semantics

The structured retry policy SHALL define how repeated failures progress through retry attempts, how delay is derived for each attempt, and which runtime events reset the retry streak.

#### Scenario: Equivalent failures advance through the configured policy

- **WHEN** repeated equivalent failures occur for the same unresolved runtime recovery context
- **THEN** the runtime derives the next attempt state and next delay from the resolved retry policy
- **AND** the resulting next wake timing is consistent with the configured progression law

#### Scenario: Reset events clear retry progression objectively

- **WHEN** a configured reset event such as durable progress, manual retry reset, or new external input occurs
- **THEN** the runtime clears the retry progression according to the resolved policy
- **AND** later recovery attempts restart from the policy's initial state
