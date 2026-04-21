## MODIFIED Requirements

### Requirement: Runtime SHALL publish a skills list for progressive discovery
Each AI model round SHALL receive runtime skill discovery through an attention-backed skill snapshot surface plus the dedicated `skill` runtime interface instead of through prompt-owned `skillsList` glue. The AI-visible snapshot SHALL contain discovery metadata only, while detailed instructions and examples remain available through runtime skill reads and filesystem-backed expansion.

#### Scenario: Skill snapshot reflects runtime-visible sources only
- **WHEN** the runtime refreshes the canonical skill snapshot for avatar `principal-123`
- **THEN** it includes skills visible from the runtime-visible shared, global, avatar, and built-in roots
- **AND** it does not enumerate unrelated or inaccessible skill roots

#### Scenario: Skill discovery no longer depends on bootstrap prompt concatenation
- **WHEN** the runtime prepares a model call
- **THEN** the skill summary reaches the model through the canonical rendered skill context
- **AND** the runtime does not concatenate a standalone `skills.list` string into `AGENTER_SYSTEM` or `systemPrompt`

### Requirement: Runtime SHALL expose an attention-scoped local API for CLI access
Each started runtime SHALL expose a loopback-local API surface for attention, message, workspace, terminal, and skill CLI commands. Requests SHALL authenticate using the avatar principal private key injected into the runtime shell environment.

#### Scenario: CLI can call runtime-local API with injected principal key
- **WHEN** root workspace bash executes `attention list`, `message send ...`, or `skill list`
- **THEN** the command calls the runtime-local API using the injected base URL and principal private key
- **AND** the runtime authorizes the request only if the private key resolves to the runtime avatar principal

#### Scenario: Wrong principal key is rejected
- **WHEN** a CLI command calls the runtime-local API with a private key that resolves to a different principal
- **THEN** the API rejects the request
- **AND** the command does not receive protected runtime data

### Requirement: Root workspace bash SHALL expose runtime CLI commands in-shell
The shell environment behind `root_workspace_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `skill`, and `tool`.

#### Scenario: Shell exposes CLI commands as normal command names
- **WHEN** the AI runs `which attention`, `which workspace`, or `which skill` inside `root_workspace_bash`
- **THEN** each command is discoverable and executable from that shell session
- **AND** each command obeys the same mount and credential boundaries as the runtime

### Requirement: Skill CLI SHALL expose controlled config inspection and replacement
The public `skill` surface SHALL expose `get-config` and `set-config` for per-skill watcher metadata, without becoming a general-purpose file read/write surface for arbitrary skill-directory files.

#### Scenario: Get-config returns watcher metadata instead of arbitrary sibling file contents
- **WHEN** the AI runs `skill get-config` for a visible skill
- **THEN** the runtime returns skill identity, `skillDir`, `skillPath`, `configPath`, config existence, parsed config, and resolved watch targets
- **AND** it does not return arbitrary undeclared sibling file contents

#### Scenario: Set-config replaces the whole config object and refreshes watcher topology
- **WHEN** the AI runs `skill set-config` with a new config object
- **THEN** the runtime replaces the entire `ccski.config.json` payload
- **AND** it recalculates the watched-file topology immediately

#### Scenario: Built-in config writes require pre-existing workspace authority
- **GIVEN** a visible built-in skill resolves to a package-owned source path
- **WHEN** the AI runs `skill set-config` for that built-in skill
- **THEN** the write succeeds only if the runtime already has `rw` workspace authority covering that config path
- **AND** the `skill` surface itself does not grant any new filesystem authority
