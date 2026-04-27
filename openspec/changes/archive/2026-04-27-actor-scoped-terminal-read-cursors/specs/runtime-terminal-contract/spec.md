## MODIFIED Requirements

### Requirement: Runtime terminal reads SHALL carry explicit representation metadata

Whenever runtime events or snapshots include terminal read results, the payload SHALL declare whether the representation is a diff or a snapshot, SHALL preserve the global terminal id, title, and status context needed by terminal-facing UI, SHALL expose whether the read was recorded into durable activity history, and SHALL carry actor-scoped read cursor metadata when git-log cursors are available.

#### Scenario: Runtime publishes a compact diff representation

- **WHEN** the terminal read path chooses a diff as the compact representation
- **THEN** the payload includes `representation = "diff"`
- **AND** it preserves `terminalId`, `fromHash`, `toHash`, `diff`, `bytes`, `status`, `processPhase`, and optional `title`
- **AND** client consumers can render diff output without inferring representation from field presence

#### Scenario: Runtime publishes a full snapshot representation

- **WHEN** the terminal read path chooses a snapshot representation
- **THEN** the payload includes `representation = "snapshot"`
- **AND** it preserves `terminalId`, `seq`, `cols`, `rows`, `cursor`, `tail`, `status`, `processPhase`, and optional `title`
- **AND** client consumers can render snapshot output without treating it as a diff

#### Scenario: Runtime publishes activity recording status

- **WHEN** a terminal read is executed without activity recording
- **THEN** the runtime payload identifies the representation without appending or implying a durable activity event
- **THEN** client consumers can inspect terminal state without fabricating activity history

#### Scenario: Runtime read carries actor cursor metadata

- **WHEN** a consuming runtime terminal read advances a git-log backed terminal cursor
- **THEN** the payload exposes `readCursor.readerActorId`
- **AND** the payload exposes the cursor `fromHash`, `toHash`, and `consumed` status
- **AND** client-side optimistic activity can attribute the read to the same actor without guessing from route state
