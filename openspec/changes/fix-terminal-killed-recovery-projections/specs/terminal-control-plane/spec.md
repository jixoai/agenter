## ADDED Requirements

### Requirement: Daemon recovery killed flow SHALL be observable and idempotent
The terminal control plane SHALL replay stale-running daemon recovery through the same killed flow used by explicit stop and natural PTY exit. Recovery MUST emit lifecycle-class consequences that downstream runtime and projection consumers can observe, and it MUST be idempotent for a terminal that has already completed the killed flow.

#### Scenario: Cold start replays stale running terminal death
- **WHEN** daemon startup detects a durable terminal record with `processPhase = running` but no live PTY can exist for it
- **THEN** the control plane routes that terminal through the shared killed flow with reason `daemon_recovery_killed`
- **AND** the resulting publication is lifecycle-class rather than a generic update
- **AND** downstream consumers can run the same post-workflow as explicit terminal death

#### Scenario: Recovery does not emit duplicate killed effects
- **GIVEN** a terminal already completed the killed flow with reason `daemon_recovery_killed`
- **WHEN** recovery replay is invoked again for the same terminal without a new live bootstrap
- **THEN** the terminal remains killed
- **AND** the control plane does not emit duplicate lifecycle effects for the same killed transition

#### Scenario: Recovered killed terminal leaves live projection
- **WHEN** recovery completes the killed flow for a stale running terminal
- **THEN** the live projection excludes that terminal
- **AND** the killed history projection includes that terminal until archive or delete

### Requirement: Killed terminal bootstrap SHALL require explicit history recovery intent
The terminal control plane SHALL treat bootstrap of a killed terminal as an explicit history recovery operation, not as the default path for product reconnection. Live `not_started` bootstrap and killed-history recovery MUST be distinguishable at the API boundary.

#### Scenario: Live not-started bootstrap remains normal
- **WHEN** a live non-archived terminal has `processPhase = not_started`
- **THEN** an authorized bootstrap starts its PTY through the normal live lifecycle path
- **AND** the terminal remains part of the live projection after bootstrap succeeds

#### Scenario: Killed bootstrap requires recovery intent
- **WHEN** a terminal has completed the killed flow
- **AND** a caller invokes bootstrap without explicit killed-history recovery intent
- **THEN** the control plane rejects the request with a clear lifecycle error
- **AND** the terminal remains in killed history

#### Scenario: Explicit killed recovery is auditable
- **WHEN** an authorized caller explicitly recovers a killed-history terminal
- **THEN** the control plane records that recovery as a lifecycle transition distinct from ordinary live bootstrap
- **AND** the recovered terminal re-enters live projection only after that explicit recovery succeeds
