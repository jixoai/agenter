# runtime-resource-mount-law Specification

## Purpose
Define how runtime boot and recovery restore only explicitly attached rooms, terminals, and workspaces.

## Requirements

### Requirement: Runtime boot SHALL distinguish cold boot from recovery boot
App-server SHALL treat a fresh runtime boot as an unattached identity start and SHALL treat recovery boot as a reattachment flow driven by durable resource facts. Cold boot MUST NOT synthesize attached rooms, terminals, or workspaces that were never explicitly mounted.

#### Scenario: Fresh runtime boot starts unattached
- **WHEN** a runtime starts without any previously attached durable room, terminal, or workspace facts
- **THEN** the runtime starts with no attached room, no attached terminal, and no mounted workspace access
- **AND** the boot path does not invent those resources from `session.cwd`, default room helpers, or terminal config defaults

#### Scenario: Recovery boot restores only previously attached resources
- **WHEN** a runtime restarts after explicit room, terminal, or workspace attachments were durably recorded
- **THEN** the runtime reattaches only those resources that still have valid durable facts
- **AND** it does not widen access by synthesizing new mounts or grants during boot

### Requirement: Attention context SHALL index recovery without becoming the permission authority
Attention context SHALL help the runtime discover which previously attached resources still matter during recovery, but it MUST NOT act as the authority that grants room, terminal, or workspace access.

#### Scenario: Attention context points to a still-valid attachment
- **WHEN** recovery sees an attention context that references a resource whose durable grant or mount still exists
- **THEN** the runtime may use that context as a recovery hint to reattach the resource
- **AND** the actual permission decision still comes from the resource system's durable facts

#### Scenario: Attention context references a revoked attachment
- **WHEN** recovery sees an attention context for a room, terminal, or workspace whose durable grant has been revoked or detached
- **THEN** the runtime does not restore that attachment
- **AND** it preserves the historical attention fact without minting new permission

### Requirement: Terminal recovery SHALL restore observable state instead of hidden process memory
Runtime recovery SHALL restore terminal references and current published terminal state, while TerminalSystem remains responsible for whether the process is still alive and what snapshot is available.

#### Scenario: Restored terminal publishes current state after restart
- **WHEN** a runtime recovers a previously attached terminal
- **THEN** the runtime republishes that terminal's current snapshot, running state, and cwd from TerminalSystem
- **AND** the AI can inspect that state to decide whether it must recover prior shell context explicitly
