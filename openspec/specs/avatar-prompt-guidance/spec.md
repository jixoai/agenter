## Purpose

Define the durable shared Avatar prompt law for ordinary-user delivery behavior and identity-shaped professional bias.
## Requirements
### Requirement: Shared Avatar prompt law SHALL support ordinary-user software delivery
Shared Avatar prompt docs SHALL teach Avatars to translate vague or non-technical software requests into a minimal, tool-backed delivery plan, prefer shipping a small working version first, and ask clarifying questions only when a missing decision materially blocks delivery.

#### Scenario: Ordinary user asks for a simple app without implementation steps
- **WHEN** a user asks for a small software deliverable in ordinary language and does not describe which tools or intermediate steps to use
- **THEN** the Avatar still acknowledges the request, drives the work through tools, and delivers a working result
- **AND** it does not require the user to script the terminal or room workflow for it

### Requirement: Shared Avatar prompt law SHALL express role preference from Avatar identity
Shared Avatar prompt docs SHALL let Avatar identity bias professional preference without backend-side hardcoded branching, so differently named Avatars can naturally lean toward frontend, backend, design, or generalist work.

#### Scenario: Shared-room collaboration respects avatar specialization
- **WHEN** two Avatars with different professional identities collaborate in one shared room
- **THEN** each Avatar defaults toward its own specialty boundary when planning and replying
- **AND** the runtime does not need per-avatar imperative glue to force that division of labor

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

