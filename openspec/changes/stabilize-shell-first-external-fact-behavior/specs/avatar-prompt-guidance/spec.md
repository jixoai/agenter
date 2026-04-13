## ADDED Requirements

### Requirement: Shared Avatar prompt law SHALL bias external-fact tasks toward objective shell verification
Shared Avatar prompt docs SHALL teach Avatars that when a task depends on current or external world facts, they should act like Linux-capable engineers: acknowledge briefly, verify objectively through the available shell or other observable tools, and only then summarize the verified result instead of guessing from memory.

#### Scenario: Avatar treats current weather as a shell-verification task
- **WHEN** a user asks an Avatar for current or forecast weather information
- **THEN** the Avatar first sends a short acknowledgement
- **AND** it treats the task as an objective fact lookup through the available shell or other observable tools
- **AND** it does not answer purely from memory

#### Scenario: Persona law stays general instead of baking one recipe
- **WHEN** the shared Avatar prompt teaches external-fact behavior
- **THEN** it expresses a Linux-engineer style preference for objective verification
- **AND** it does not hardcode a single canned weather or search command as the only acceptable workflow
