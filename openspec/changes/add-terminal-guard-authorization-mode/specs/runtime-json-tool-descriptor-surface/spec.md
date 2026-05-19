## ADDED Requirements

### Requirement: Terminal write/input descriptors SHALL support guard approval creation

Descriptor-backed `terminal write` and `terminal input` operations SHALL expose approval-request creation as part of their canonical schema and help surface so AI callers can intentionally submit guarded writes for approval.

#### Scenario: Terminal write schema accepts approval request creation
- **WHEN** the runtime exposes `terminal write`
- **THEN** the descriptor schema accepts a `createApprovalRequest` boolean
- **THEN** the descriptor forwards that field to the runtime terminal write handler

#### Scenario: Terminal input schema accepts approval request creation
- **WHEN** the runtime exposes `terminal input`
- **THEN** the descriptor schema accepts a `createApprovalRequest` boolean
- **THEN** the descriptor forwards that field to the runtime terminal input handler

#### Scenario: Help documents guard approval result
- **WHEN** the AI runs `terminal write --help` or `terminal input --help`
- **THEN** the help explains that guard actors can create approval requests
- **THEN** the help explains that an approval request means the command is waiting for admin approval and did not reach the PTY yet

#### Scenario: Help documents denied, expired, and existing approval outcomes
- **WHEN** the AI runs `terminal write --help` or `terminal input --help`
- **THEN** the help explains that denied or expired approval means the requested terminal action did not happen
- **THEN** the help explains that an existing pending approval should be reported or awaited instead of resubmitted as duplicate terminal work
- **THEN** the help does not suggest using `root_bash` or `workspace_bash` as a substitute for the visible terminal action
