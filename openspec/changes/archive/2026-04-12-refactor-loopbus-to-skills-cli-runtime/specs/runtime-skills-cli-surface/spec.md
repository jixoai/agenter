# runtime-skills-cli-surface Specification

## ADDED Requirements

### Requirement: Runtime SHALL expose only root workspace primitives as model tools
Each AI model round SHALL receive only root workspace primitives as direct tools. Message, terminal, workspace, and attention system operations SHALL be performed through CLI commands inside root workspace bash execution instead of through direct model tool injection.

#### Scenario: Model receives only root workspace direct tools
- **WHEN** the runtime prepares a model call
- **THEN** the direct tool list contains `root_workspace_list` and `root_workspace_bash`
- **AND** it does not include `attention_*`, `message_*`, or `terminal_*` direct tools

### Requirement: Runtime SHALL publish a skills list for progressive discovery
Each AI model round SHALL include a lightweight `skills.list` summary built from runtime-visible skill sources. The list SHALL include discovery metadata only, while detailed instructions and examples remain available through CLI-driven expansion.

#### Scenario: Skills list reflects runtime-visible sources only
- **WHEN** the runtime builds `skills.list` for avatar `principal-123`
- **THEN** it includes skills visible from `~/.agents/skills`, `~/.agenter/skills`, and `~/.agenter/avatars/principal-123/skills`
- **AND** it does not enumerate unrelated or inaccessible skill roots

### Requirement: Runtime SHALL expose an attention-scoped local API for CLI access
Each started runtime SHALL expose a loopback-local API surface for attention, message, workspace, and terminal CLI commands. Requests SHALL authenticate using the avatar principal private key injected into the runtime shell environment.

#### Scenario: CLI can call runtime-local API with injected principal key
- **WHEN** root workspace bash executes `attention list` or `message send ...`
- **THEN** the command calls the runtime-local API using the injected base URL and principal private key
- **AND** the runtime authorizes the request only if the private key resolves to the runtime avatar principal

#### Scenario: Wrong principal key is rejected
- **WHEN** a CLI command calls the runtime-local API with a private key that resolves to a different principal
- **THEN** the API rejects the request
- **AND** the command does not receive protected runtime data

### Requirement: Root workspace bash SHALL expose runtime CLI commands in-shell
The shell environment behind `root_workspace_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `ccski`, and `tool`.

#### Scenario: Shell exposes CLI commands as normal command names
- **WHEN** the AI runs `which attention`, `which workspace`, or `which ccski` inside `root_workspace_bash`
- **THEN** each command is discoverable and executable from that shell session
- **AND** each command obeys the same mount and credential boundaries as the runtime

### Requirement: Runtime CLI SHALL accept shell stdin for long-form shell workflows
The `message` and `terminal` CLI commands exposed inside `root_workspace_bash` SHALL accept stdin payloads when the content is more natural to stream than to escape into argv.

#### Scenario: Terminal write accepts piped stdin
- **WHEN** the AI runs `cat <<'EOF' | terminal write <terminalId> --submit ... EOF`
- **THEN** the piped stdin becomes the written terminal input
- **AND** the runtime does not require the same text to be repeated inside argv

#### Scenario: Message send accepts piped stdin
- **WHEN** the AI runs `cat <<'EOF' | message send <chatId> ... EOF`
- **THEN** the piped stdin becomes the sent room content
- **AND** the runtime preserves unix-style shell composition for multi-line messages
