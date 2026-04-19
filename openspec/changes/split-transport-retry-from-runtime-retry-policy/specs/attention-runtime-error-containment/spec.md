## ADDED Requirements

### Requirement: Containment SHALL consume the resolved runtime retry policy

The runtime SHALL compute containment progression, next wake timing, and blocked/backoff transitions from the resolved runtime retry policy instead of from hard-coded retry math or implicit retry-budget constants.

#### Scenario: Equivalent failures follow policy-derived next wake timing

- **WHEN** repeated equivalent failures accumulate for the same unresolved runtime recovery context
- **THEN** the runtime derives the next wake timing from the resolved retry policy
- **AND** the containment state reflects the policy-derived progression instead of hidden built-in timing constants

#### Scenario: Policy reset conditions clear containment progression

- **WHEN** a reset condition defined by the resolved runtime retry policy occurs
- **THEN** the runtime clears or rewinds containment progression according to that policy
- **AND** later retries restart from the correct policy-defined attempt state
