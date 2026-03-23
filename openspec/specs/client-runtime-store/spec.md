# client-runtime-store Specification

## Purpose
Define the client-side runtime normalization and long-history paging contract.

## Requirements

### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics
The client runtime store SHALL treat `focusedTerminalIds` and terminal read representation metadata as first-class fields and SHALL not collapse them into legacy single-value assumptions.

#### Scenario: Store receives multiple focused terminals
- **WHEN** the runtime store ingests a snapshot or event containing several focused terminal ids
- **THEN** the store preserves the full ordered id set
- **THEN** selectors can derive a primary terminal view without discarding the rest of the set

#### Scenario: Store receives a terminal diff representation
- **WHEN** the runtime store ingests a terminal read result marked as `representation = diff`
- **THEN** it keeps that representation metadata in state
- **THEN** UI selectors can distinguish compact diff reads from full snapshots

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource
The client runtime store SHALL maintain explicit reverse-time page state for each long-history session resource and SHALL hydrate only recent windows by default.

#### Scenario: Hydration keeps a recent window
- **WHEN** the client hydrates a session with existing chat, cycles, LoopBus, or model history
- **THEN** it loads only the newest configured window for each resource
- **THEN** older history remains available through the resource paging state

#### Scenario: Loading older pages preserves order and identity
- **WHEN** the client prepends an older history page for a session resource
- **THEN** the merged list remains ordered from oldest to newest
- **THEN** already-known items are not duplicated
