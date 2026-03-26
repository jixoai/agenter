## ADDED Requirements

### Requirement: Loop scheduling is context-first
The runtime MUST consider a context active when its `scoreMap` contains at least one score greater than zero.

#### Scenario: Non-zero context scores keep the loop alive
- **GIVEN** no new external input arrives
- **AND** at least one attention context still has a score greater than zero
- **WHEN** the scheduler evaluates whether to wake the loop
- **THEN** it wakes again for attention debt.

#### Scenario: Zeroed contexts stay idle
- **GIVEN** every attention context score is zero
- **WHEN** no new external input arrives
- **THEN** the scheduler remains idle.
