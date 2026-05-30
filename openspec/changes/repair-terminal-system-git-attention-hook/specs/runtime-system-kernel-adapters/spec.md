## ADDED Requirements

### Requirement: Terminal adapter SHALL promote unread idle terminal git facts into attention

The terminal adapter SHALL treat a running focused terminal `BUSY -> IDLE` transition as an explicit terminal action predicate. When the terminal git `HEAD` hash is newer than the current runtime actor's terminal read cursor, the adapter MUST perform one existing consuming terminal read, commit the read result as terminal attention ingress, and request LoopBus notification from that committed attention item. The compared `HEAD` MUST be the TerminalSystem head after pending terminal output has been sealed into git, not a stale pre-idle hash observed before the status-idle snapshot is persisted. This bridge MUST remain owned by the runtime adapter layer: TerminalSystem MUST NOT import AttentionSystem or LoopBus, and the kernel MUST NOT add a terminal-specific scheduler branch.

#### Scenario: Focused terminal becomes idle with unread git head

- **GIVEN** a focused running terminal has current git `HEAD = H2`
- **AND** the runtime actor's read cursor for that terminal is `H1`
- **WHEN** the terminal status changes from `BUSY` to `IDLE`
- **THEN** the terminal adapter consumes one terminal read from `H1` to `H2`
- **AND** it commits the read payload as terminal `world_fact` attention ingress
- **AND** the committed attention item is wakeable so LoopBus can continue from the terminal fact

#### Scenario: Idle comparison waits for sealed terminal git truth

- **GIVEN** a focused terminal emits `BUSY -> IDLE`
- **AND** terminal output has changed but the status-idle git snapshot has not yet been observed by the runtime adapter
- **WHEN** the adapter evaluates whether terminal `HEAD` is ahead of the actor read cursor
- **THEN** it first asks TerminalSystem to seal pending output into git
- **AND** it compares the actor read cursor against that sealed terminal `HEAD`

#### Scenario: Repeated idle with already-read head is a no-op

- **GIVEN** a focused running terminal has current git `HEAD = H2`
- **AND** the runtime actor's read cursor for that terminal is also `H2`
- **WHEN** the terminal status changes from `BUSY` to `IDLE`
- **THEN** the terminal adapter does not perform a terminal read
- **AND** it does not commit duplicate terminal attention ingress
- **AND** it does not emit a terminal wake signal for that unchanged head

#### Scenario: Raw live PTY output uses the same idle bridge

- **GIVEN** a live terminal transport forwards user bytes through `inputBytes` or another raw PTY channel
- **AND** that interaction changes terminal output without creating a `terminal_write` activity record
- **WHEN** the terminal enters `IDLE` and its git `HEAD` is ahead of the runtime actor's read cursor
- **THEN** the adapter still promotes the unread terminal read into attention
- **AND** the behavior does not depend on an automation `terminal_write` event

### Requirement: Terminal adapter SHALL keep lifecycle wording scheduler-only

The terminal adapter MUST NOT restore `terminal_idle_ready` as a model-visible task phrase. The only model-visible payload produced by the idle unread bridge SHALL be the terminal read result itself.

#### Scenario: Idle ready wording remains outside attention task text

- **GIVEN** a terminal lifecycle event says the terminal is ready for input
- **WHEN** the adapter handles that lifecycle event
- **THEN** it does not commit an attention item whose title or body is the lifecycle-ready wording
- **AND** unread terminal output, if any, is represented by the terminal diff or snapshot payload instead

## MODIFIED Requirements

## REMOVED Requirements

## RENAMED Requirements
