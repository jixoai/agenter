## ADDED Requirements

### Requirement: Terminal control plane SHALL expose live and history projections over one terminal instance truth

The terminal control plane SHALL expose live, history, archive, and all/index projections over the same durable `terminal_instance` records. Live projection SHALL exclude killed and archived instances. History projection SHALL include killed non-archived instances. Index projection SHALL include live instances first, then killed non-archived instances ordered by killed time descending. None of these projections SHALL create or require a second terminal history table.

#### Scenario: Live list excludes killed terminals

- **GIVEN** one terminal instance is running
- **AND** another terminal instance has `processPhase = killed`
- **WHEN** the caller requests the live terminal projection
- **THEN** only the running terminal is returned
- **AND** the killed terminal is absent from the live list

#### Scenario: History index groups live before killed

- **GIVEN** there are live terminal instances
- **AND** there are killed non-archived terminal instances
- **WHEN** the caller requests the terminal index projection
- **THEN** live instances appear before killed instances
- **AND** killed instances are ordered by `lastStoppedAt` descending with `updatedAt` as fallback

#### Scenario: Archive remains explicit

- **GIVEN** a killed terminal instance has been archived
- **WHEN** the caller requests the default history/index projection
- **THEN** the archived terminal is absent
- **AND** it remains available only through the archive projection until delete
