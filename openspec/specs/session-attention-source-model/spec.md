# session-attention-source-model Specification

## Purpose

Define the durable runtime model where sessions anchor on attention and workspace, while room, terminal, task, and future system facts enter through `attentionContext` source bindings instead of a built-in room field.

## Requirements

### Requirement: Session runtime SHALL anchor on attention and workspace, not on a built-in room

The durable session/runtime model SHALL treat `attentionSystem` and `workspaceSystem` as the visible hard runtime anchors. `messageSystem`, `terminalSystem`, `taskSystem`, and future systems SHALL remain external source systems whose facts are projected into the runtime through `attentionContext` and source bindings. The model MUST NOT encode a built-in room as part of session identity or runtime identity.

#### Scenario: Session identity stays independent from room existence

- **GIVEN** a session is created or resumed
- **WHEN** the durable session model and runtime model are inspected
- **THEN** they describe the Avatar runtime, attention state, and workspace state
- **AND** they do not require a built-in room field to make the session valid
- **AND** message/terminal/task participation is expressed through attention-context source bindings instead of a session-owned default room

### Requirement: Durable session data SHALL not persist `primaryRoomId` or an equivalent default-room field

The durable session model, session JSON, session catalog metadata, runtime bootstrap options, and stopped-session recovery path SHALL NOT persist `primaryRoomId` or any equivalent field whose meaning is "the session's built-in/default room". If migration data exists, it MUST be treated as compatibility input only and MUST be removed by this change's end state.

#### Scenario: Session persistence contains no default-room field

- **GIVEN** a session is created, started, stopped, or restarted
- **WHEN** its durable session metadata and runtime bootstrap inputs are read
- **THEN** no `primaryRoomId` field or equivalent default-room field is present
- **AND** the runtime can still reconstruct its state from attention contexts, workspace facts, and external-system source facts

### Requirement: Attention-context source bindings SHALL be the routing anchor for external-system state

Runtime understanding of message rooms, terminal instances, task subjects, and future external-system facts SHALL be routed through `attentionContext` state plus source refs. Notification state, unread buckets, cold-restart recovery, and follow-up routing MUST derive from those source bindings rather than from a session-level default room.

#### Scenario: Stopped-session unread recovery uses attention source facts

- **GIVEN** a stopped session has persisted attention contexts whose source refs point at message-system rows
- **WHEN** unread state and notification state are reconstructed
- **THEN** unread buckets and visible notification items are derived from those attention-context source refs
- **AND** recovery does not require a session-level default room field

#### Scenario: Restarted runtime rebuilds message and terminal understanding from source bindings

- **GIVEN** a session restarts after message-system and terminal-system facts already exist
- **WHEN** the runtime rebuilds its operator-visible state
- **THEN** the runtime rehydrates message and terminal understanding from attention-context source bindings and durable external-system facts
- **AND** it does not reintroduce a synthetic default room to fill missing context
