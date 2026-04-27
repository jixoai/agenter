## Purpose

Define the canonical control plane for global terminal lifecycle, focus, inspection, and operating-system execution guidance.
## Requirements
### Requirement: Terminal focus SHALL be managed as a declarative focus set
The global terminal control plane SHALL manage focused terminals through a declarative `terminal_focus` operation that supports `add`, `remove`, `replace`, and `clear` semantics over globally durable terminal ids, and it SHALL preserve actor-scoped focus or presence state without requiring terminal ownership to match a single session runtime.

#### Scenario: Clear the focus set for an attached actor
- **WHEN** a caller invokes terminal focus with `op = clear`
- **THEN** that caller's focused-terminal set becomes empty
- **THEN** later attention or UI rules can distinguish between "no focused terminal" and "one or more focused terminals"

#### Scenario: Focus does not transfer terminal ownership to a session
- **WHEN** a session actor focuses an existing global terminal
- **THEN** the terminal remains part of the global terminal catalog
- **THEN** stopping that session does not delete the terminal or its durable grants

#### Scenario: Focused terminals feed the attention-source pipeline
- **WHEN** the focused-terminal set includes one or more running terminals
- **THEN** semantic changes from those terminals are eligible for terminal-source invalidation into LoopBus attention ingestion
- **THEN** unfocused terminals do not bypass the source adapter path to trigger model work directly

#### Scenario: Focused terminal observations default to passive history
- **WHEN** focused terminal output is persisted into the attention source pipeline for inspection
- **THEN** that output remains queryable in terminal attention history
- **AND** it does not automatically become unresolved debt unless the terminal event is explicitly modeled as actionable

### Requirement: Terminal inspection SHALL prefer read and snapshot primitives
The terminal control plane SHALL expose `terminal_read` and `terminal_snapshot` as the primary inspection primitives, and `terminal_read` SHALL return the most compact available representation for the requested terminal state without mutating grants or lifecycle state.

#### Scenario: Read explicitly forces snapshot
- **WHEN** a caller invokes `terminal_read` with `mode = snapshot`
- **THEN** the runtime returns the same full representation contract as `terminal_snapshot`
- **THEN** the payload still declares that the returned representation is a snapshot

#### Scenario: Snapshot returns full renderable terminal state
- **WHEN** a caller invokes `terminal_snapshot` for a running terminal with scrollback beyond the viewport
- **THEN** the payload includes the full renderable snapshot contract needed to hydrate a terminal viewport
- **THEN** the payload is not reduced to a tail-only excerpt

#### Scenario: Inspection does not auto-start a stopped terminal
- **WHEN** a caller invokes `terminal_read` or `terminal_snapshot` for a stopped terminal
- **THEN** the control plane returns a terminal-not-running style failure
- **THEN** the inspection path does not implicitly start the terminal process

#### Scenario: Inspection does not create hidden bootstrap access
- **WHEN** a caller performs a read-only inspection path
- **THEN** the control plane does not create or refresh a trusted bootstrap grant as a side effect
- **THEN** catalog access state changes only through explicit grant or lifecycle operations

### Requirement: Terminal read cursors SHALL be actor-scoped
Terminal output SHALL remain a shared physical fact, but git-log/diff read progress SHALL be owned by the reading actor. A consuming terminal read MUST advance only that actor's read cursor and MUST NOT consume output for other actors or terminal seats.

#### Scenario: Two actors consume the same diff independently
- **WHEN** two actors share one git-log backed terminal and both have read access
- **AND** one actor consumes a terminal diff
- **THEN** the other actor can still consume that same diff from their own read cursor
- **AND** the first actor's next read starts from the cursor advanced by their own consuming read

#### Scenario: Seat tokens resolve the reader actor
- **WHEN** a caller reads a terminal through a terminal access token
- **THEN** the read cursor is keyed by the token grant's participant actor
- **AND** a token-backed read does not fall back to a terminal-global cursor

#### Scenario: Non-consuming inspection preserves read progress
- **WHEN** a caller reads a terminal with `remark = false`
- **THEN** the returned payload may describe the actor's current read cursor
- **AND** the durable read cursor for that actor is not advanced

### Requirement: Terminal control plane SHALL own terminal lifecycle operations
The terminal control plane SHALL expose lifecycle operations for listing, creating, bootstrapping, stopping, and deleting globally durable terminal instances through one canonical API family independent of session startup order.

#### Scenario: Create a global shell terminal without first booting a session
- **WHEN** an authorized caller invokes terminal create without an explicit process descriptor
- **THEN** the control plane creates a terminal using the default shell profile in the global terminal catalog
- **THEN** the response returns the terminal id and applied process profile metadata

#### Scenario: Stop preserves a global terminal's durable identity
- **WHEN** a caller with sufficient rights invokes terminal stop for an existing running terminal id
- **THEN** the PTY is stopped without deleting the terminal's durable catalog entry
- **THEN** later reads still resolve the same terminal id as a stopped terminal until an explicit bootstrap or delete occurs

### Requirement: Terminal control plane SHALL define operating-system execution semantics through skills and attention
The terminal control plane SHALL express terminal-side obligations through durable terminal facts and attention items, and the owning terminal skill guidance SHALL describe terminal as the assistant's operating-system workbench. That guidance SHALL prioritize terminal-backed inspection and execution when work depends on external facts, commands, files, processes, or network state.

#### Scenario: Terminal skill prefers terminal for external facts
- **WHEN** model work requires network, filesystem, process, command, or operating-system facts
- **THEN** the terminal skill directs the assistant to use terminal-backed execution before answering
- **AND** unverified external facts are not treated as completed work

#### Scenario: Terminal skill allows tool composition through terminal
- **WHEN** the available shell commands are insufficient for the task
- **THEN** the terminal skill allows the assistant to combine commands or author temporary scripts through terminal tools
- **AND** terminal failure can be escalated through other systems instead of fabricated answers

### Requirement: Terminal approval history SHALL expose durable state transitions
The terminal control plane SHALL retain approval requests across `pending`, `approved`, `denied`, and `expired` states, and approval queries MUST filter over durable approval history rather than a pending-only view.

#### Scenario: Query approved requests
- **WHEN** a pending approval request is approved for a terminal
- **THEN** `listApprovalRequests(statuses=["approved"])` returns that request
- **THEN** `listApprovalRequests(statuses=["pending"])` no longer returns it

#### Scenario: Query denied requests
- **WHEN** a pending approval request is denied for a terminal
- **THEN** `listApprovalRequests(statuses=["denied"])` returns that request
- **THEN** operators can inspect the historical denial without reconstructing it from leases or events

### Requirement: Terminal observation activity SHALL be caller controlled
Terminal read cursor consumption and terminal activity recording are separate controls. Cursor consumption SHALL be controlled by `remark`; activity records for reads SHALL be controlled by `recordActivity`.

#### Scenario: Pure inspection does not record activity
- **WHEN** a caller reads a terminal snapshot with activity recording disabled
- **THEN** no `terminal_read` activity event is appended
- **THEN** the terminal's activity history remains unchanged

#### Scenario: Explicit observation records activity
- **WHEN** a caller reads a terminal with activity recording enabled
- **THEN** a `terminal_read` activity event is appended
- **THEN** the appended event preserves the chosen representation metadata
