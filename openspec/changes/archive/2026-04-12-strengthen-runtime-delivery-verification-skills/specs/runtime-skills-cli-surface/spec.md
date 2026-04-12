# runtime-skills-cli-surface Specification

## MODIFIED Requirements

### Requirement: Runtime SHALL publish a skills list for progressive discovery
Each AI model round SHALL include a lightweight `skills.list` summary built from runtime-visible skill sources. The list SHALL include discovery metadata only, while detailed instructions and examples remain available through CLI-driven expansion.

#### Scenario: Built-in runtime skills teach durable delivery verification
- **WHEN** the runtime writes built-in skills for shell-visible systems
- **THEN** the terminal/runtime skill content explains that `terminal write` only submits input
- **AND** the skill content instructs the AI to `terminal read` and then externally verify the promised URL before sending a room delivery message

### Requirement: Root workspace bash SHALL expose runtime CLI commands in-shell
The shell environment behind `root_workspace_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `ccski`, and `tool`.

#### Scenario: Delivery announcement happens only after terminal and curl verification
- **GIVEN** an avatar is launching a durable local service for another room participant
- **WHEN** the AI follows the built-in runtime skills
- **THEN** it first launches or recovers the service through `terminal`
- **AND** it reads terminal output to confirm the process did not immediately fail
- **AND** it verifies the exact promised URL from a fresh root workspace shell check before announcing delivery in the room
