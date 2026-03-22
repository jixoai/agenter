## MODIFIED Requirements

### Requirement: Terminal focus SHALL be managed as a declarative focus set
The terminal control plane SHALL manage focused terminals through a declarative `terminal_focus` operation that supports `add`, `remove`, `replace`, and `clear` semantics over a terminal id set.

#### Scenario: Focused terminals feed the attention-source pipeline
- **WHEN** the focused-terminal set includes one or more running terminals
- **THEN** semantic changes from those terminals are eligible for terminal-source invalidation into LoopBus attention ingestion
- **THEN** unfocused terminals do not bypass the source adapter path to trigger model work directly
