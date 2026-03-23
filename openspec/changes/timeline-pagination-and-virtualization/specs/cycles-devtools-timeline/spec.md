## MODIFIED Requirements

### Requirement: Long cycle history SHALL remain navigable
The Devtools cycle timeline SHALL remain operable for long-running sessions by virtualizing the timeline list, incrementally loading older pages, and preserving stable selection behavior.

#### Scenario: Large cycle history keeps the panel responsive
- **WHEN** the session contains many historical cycles
- **THEN** the cycle timeline virtualizes the list instead of mounting every row at once
- **THEN** selection and scrolling remain responsive

#### Scenario: Older cycle pages preserve selection context
- **WHEN** the user prepends older cycle history while inspecting a selected cycle
- **THEN** the current selection remains stable
- **THEN** the newly prepended rows do not reset the detail panel
