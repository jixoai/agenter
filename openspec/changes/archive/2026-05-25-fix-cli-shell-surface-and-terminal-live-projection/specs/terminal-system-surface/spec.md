## ADDED Requirements

### Requirement: Terminal-system SHALL present live terminals by default and history as an explicit index

The Studio terminal-system workbench SHALL treat `/terminals` and live terminal detail tabs as live projections only. Killed terminal instances SHALL NOT appear as ordinary live tabs or the default live redirect target. The explicit history/index route SHALL show live instances first, followed by killed non-archived instances sorted by killed time, so operators can discover both active and dead terminal instances without confusing dead records for live sessions.

#### Scenario: Default terminal route selects only live terminal

- **GIVEN** Studio has loaded one live terminal and one killed terminal
- **WHEN** the operator opens `/terminals`
- **THEN** the redirect target is the live terminal detail route
- **AND** the killed terminal is not selected as the default live terminal

#### Scenario: Live workbench tabs exclude killed terminals

- **GIVEN** Studio has loaded live and killed terminal projections
- **WHEN** the terminal workbench renders live terminal tabs
- **THEN** only live terminals appear as ordinary terminal tabs
- **AND** killed terminals are reachable through the History tab or index route

#### Scenario: History index shows active first then killed by killed time

- **GIVEN** Studio has loaded live terminals and killed non-archived terminals
- **WHEN** the operator opens `/terminals/history`
- **THEN** the route lists live terminals before killed terminals
- **AND** killed terminals are sorted by killed time descending
- **AND** each killed row still supports archive and delete actions
