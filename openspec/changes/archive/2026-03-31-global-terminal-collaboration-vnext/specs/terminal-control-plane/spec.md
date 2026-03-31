## MODIFIED Requirements

### Requirement: Terminal focus SHALL be managed as a declarative focus set
The global terminal control plane SHALL manage focused terminals through a declarative focus operation over globally durable terminal ids, and it SHALL preserve actor-scoped focus or presence state without requiring terminal ownership to match a single session runtime.

#### Scenario: Clear the focus set for an attached actor
- **WHEN** a caller invokes terminal focus with `op = clear`
- **THEN** that caller's focused-terminal set becomes empty
- **THEN** later attention or UI rules can distinguish between "no focused terminal" and "one or more focused terminals"

#### Scenario: Focus does not transfer terminal ownership to a session
- **WHEN** a session actor focuses an existing global terminal
- **THEN** the terminal remains part of the global terminal catalog
- **THEN** stopping that session does not delete the terminal or its durable grants

### Requirement: Terminal control plane SHALL own terminal lifecycle operations
The terminal control plane SHALL expose lifecycle operations for listing, creating, attaching, and killing globally durable terminal instances through one canonical API family independent of session startup order.

#### Scenario: Create a global shell terminal without first booting a session
- **WHEN** an authorized caller invokes terminal create without an explicit process descriptor
- **THEN** the control plane creates a terminal using the default shell profile in the global terminal catalog
- **THEN** the response returns the terminal id and applied process profile metadata

#### Scenario: Kill a global terminal
- **WHEN** a caller with sufficient rights invokes terminal kill for an existing terminal id
- **THEN** the process is stopped and removed from the active global terminal list
- **THEN** later reads for that terminal id fail with a terminal-not-found style error
