## MODIFIED Requirements

### Requirement: Loop scheduling is context-first
The runtime MUST consider a context active when its `scoreMap` contains at least one score greater than zero. Active debt SHALL remain queryable and observable, but non-zero scores alone SHALL NOT force a new model round. Later scheduling SHALL require an explicit runnable wake cause such as new ingress, task-trigger fire, backoff expiry explicitly produced by another system, or another committed attention delta.

#### Scenario: Non-zero context scores remain active without auto-waking the loop
- **GIVEN** no new external input arrives
- **AND** at least one attention context still has a score greater than zero
- **WHEN** the scheduler evaluates whether to wake the loop
- **THEN** it keeps that context active as unresolved debt
- **THEN** it does not wake again solely because the score remains non-zero

#### Scenario: Explicit trigger fire reactivates unresolved debt
- **GIVEN** at least one attention context is still active or future work was delegated from it
- **WHEN** a task trigger or another explicit wake source commits new attention input later
- **THEN** the scheduler may wake the loop for that new runnable cause
- **THEN** the next round is attributed to that explicit wake cause rather than to score existence alone

#### Scenario: Zeroed contexts stay idle
- **GIVEN** every attention context score is zero
- **WHEN** no new external input arrives
- **THEN** the scheduler remains idle
