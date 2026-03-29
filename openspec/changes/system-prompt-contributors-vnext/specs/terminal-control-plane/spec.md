## ADDED Requirements

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
