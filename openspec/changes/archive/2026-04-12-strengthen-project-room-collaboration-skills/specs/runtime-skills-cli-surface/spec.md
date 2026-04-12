# runtime-skills-cli-surface Specification

## MODIFIED Requirements

### Requirement: Runtime SHALL publish a skills list for progressive discovery
Each AI model round SHALL include a lightweight `skills.list` summary built from runtime-visible skill sources. The list SHALL include discovery metadata only, while detailed instructions and examples remain available through CLI-driven expansion.

#### Scenario: Skills list exposes shared-room collaboration law
- **WHEN** the runtime builds `skills.list`
- **THEN** built-in collaboration guidance appears as a discoverable runtime skill summary
- **AND** that summary tells the AI to obey shared-room protocol, keep single-source truth, and correct invalid room messages instead of defending them

### Requirement: Root workspace bash SHALL expose runtime CLI commands in-shell
The shell environment behind `root_workspace_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `ccski`, and `tool`.

#### Scenario: Collaboration skill teaches role and correction law
- **GIVEN** an avatar is collaborating with other avatars in a shared room
- **WHEN** the AI expands the collaboration skill
- **THEN** the skill explains that room messages are durable truth, contracts must have a single owner, and user-invalidated messages should be replaced with corrected protocol-compliant replies
