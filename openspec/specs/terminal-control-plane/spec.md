## Purpose

Define the canonical control plane for terminal lifecycle, focus, and inspection operations.

## Requirements

### Requirement: Terminal focus SHALL be managed as a declarative focus set
The terminal control plane SHALL manage focused terminals through a declarative `terminal_focus` operation that supports `add`, `remove`, `replace`, and `clear` semantics over a terminal id set.

#### Scenario: Clear the focus set
- **WHEN** a caller invokes `terminal_focus` with `op = clear`
- **THEN** the focused-terminal set becomes empty
- **THEN** later reads or attention rules can distinguish between "no focused terminal" and "one focused terminal"

#### Scenario: Focused terminals feed the attention-source pipeline
- **WHEN** the focused-terminal set includes one or more running terminals
- **THEN** semantic changes from those terminals are eligible for terminal-source invalidation into LoopBus attention ingestion
- **THEN** unfocused terminals do not bypass the source adapter path to trigger model work directly

### Requirement: Terminal inspection SHALL prefer read and snapshot primitives
The terminal control plane SHALL expose `terminal_read` and `terminal_snapshot` as the primary inspection primitives, and `terminal_read` SHALL return the most compact available representation for the requested terminal state.

#### Scenario: Read explicitly forces snapshot
- **WHEN** a caller invokes `terminal_read` with `mode = snapshot`
- **THEN** the runtime returns the same full representation contract as `terminal_snapshot`
- **THEN** the payload still declares that the returned representation is a snapshot

### Requirement: Terminal control plane SHALL own terminal lifecycle operations
The terminal control plane SHALL expose lifecycle operations for listing, creating, and killing terminal instances through one canonical API family.

#### Scenario: Create a default shell terminal
- **WHEN** a caller invokes `terminal_create` without an explicit process descriptor
- **THEN** the control plane creates a terminal using the default shell profile
- **THEN** the response returns the terminal id and the applied process profile metadata

#### Scenario: Kill a created terminal
- **WHEN** a caller invokes `terminal_kill` for an existing terminal id
- **THEN** the process is stopped and removed from the active terminal list
- **THEN** later reads for that terminal id fail with a terminal-not-found style error

### Requirement: Terminal control plane SHALL define operating-system execution semantics for model work
The terminal control plane SHALL contribute provider-owned system guidance that describes terminal as the assistant's operating-system workbench. That guidance SHALL prioritize terminal-backed inspection and execution when work depends on external facts, commands, files, processes, or network state.

#### Scenario: Prompt guide prefers terminal for external facts
- **WHEN** model work requires network, filesystem, process, command, or operating-system facts
- **THEN** the system prompt directs the assistant to use terminal tools before answering
- **AND** unverified external facts are not treated as completed work

#### Scenario: Prompt guide allows tool composition through terminal
- **WHEN** the available shell commands are insufficient for the task
- **THEN** the system prompt allows the assistant to combine commands or author temporary scripts through terminal tools
- **AND** terminal failure can be escalated through other systems instead of fabricated answers
