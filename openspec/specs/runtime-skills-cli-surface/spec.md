# runtime-skills-cli-surface Specification

## Purpose
Define the runtime's root-workspace-only tool surface, progressive skill discovery model, and attention-scoped CLI/API laws.

## Requirements

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

#### Scenario: Skills list exposes shared-room collaboration law
- **WHEN** the runtime builds `skills.list`
- **THEN** built-in collaboration guidance appears as a discoverable runtime skill summary
- **AND** that summary tells the AI to obey shared-room protocol, keep single-source truth, and correct invalid room messages instead of defending them

#### Scenario: Built-in runtime skills teach durable delivery verification
- **WHEN** the runtime writes built-in skills for shell-visible systems
- **THEN** the terminal/runtime skill content explains that `terminal write` only submits input
- **AND** the skill content instructs the AI to `terminal read` and then externally verify the promised URL before sending a room delivery message

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

#### Scenario: Collaboration skill teaches role and correction law
- **GIVEN** an avatar is collaborating with other avatars in a shared room
- **WHEN** the AI expands the collaboration skill
- **THEN** the skill explains that room messages are durable truth, contracts must have a single owner, and user-invalidated messages should be replaced with corrected protocol-compliant replies

#### Scenario: Delivery announcement happens only after terminal and curl verification
- **GIVEN** an avatar is launching a durable local service for another room participant
- **WHEN** the AI follows the built-in runtime skills
- **THEN** it first launches or recovers the service through `terminal`
- **AND** it reads terminal output to confirm the process did not immediately fail
- **AND** it verifies the exact promised URL from a fresh root workspace shell check before announcing delivery in the room

### Requirement: Runtime CLI SHALL accept shell stdin for long-form shell workflows
The `message`, `terminal`, and `attention commit` CLI commands exposed inside `root_workspace_bash` SHALL accept JSON stdin payloads when the content is more natural to stream than to escape into argv.

#### Scenario: Terminal write accepts piped stdin
- **WHEN** the AI calls `root_workspace_bash` with `command="terminal write"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated terminal-write payload
- **AND** the runtime does not require the same JSON to be repeated inside argv

#### Scenario: Message send accepts piped stdin
- **WHEN** the AI calls `root_workspace_bash` with `command="message send"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated room-message payload
- **AND** the runtime preserves unix-style shell composition for multi-line message bodies

#### Scenario: Attention commit still accepts JSON stdin for full payload control
- **WHEN** the AI calls `root_workspace_bash` with `command="attention commit"` and a JSON payload in `stdin`
- **THEN** the runtime parses the JSON payload exactly
- **AND** shell tooling keeps the full JSON escape hatch for long-form settle flows

### Requirement: Runtime guidance SHALL default descriptor-backed JSON transport to stdin
Built-in runtime skills, references, and top-level runtime prompts SHALL teach that descriptor-backed runtime-local CLI commands use a minimal `root_workspace_bash.command` plus JSON `stdin` by default, while a single argv JSON payload remains only a compact fallback for trivially short requests. When `--compact` is available, guidance SHALL present it as an optional encoding surface, not as a replacement for standard object JSON.

#### Scenario: Message, terminal, and attention guidance prefer stdin-first transport
- **WHEN** the runtime renders built-in guidance for `message`, `terminal`, `attention`, or the top-level runtime prompt surface
- **THEN** the examples teach `command=<bare action>` plus JSON `stdin` as the default transport
- **AND** any argv JSON example is described only as the compact fallback for trivially short payloads
- **AND** compact mode is still surfaced as available per command when the AI wants positional payloads

### Requirement: Runtime guidance SHALL expose compact mode independently per system skill
Built-in runtime skills, references, and top-level runtime prompts SHALL teach `--compact` as an optional encoding surface for descriptor-backed runtime CLI commands while keeping each system skill independently responsible for its own examples.

#### Scenario: System skills teach compact mode without centralizing skill ownership
- **WHEN** the runtime renders built-in guidance for `message`, `terminal`, `attention`, or the top-level runtime prompt surface
- **THEN** each system skill may show its own `--compact` examples and fallback hints
- **AND** the runtime does not replace those independent skill notes with one centralized compact-only skill

### Requirement: Runtime-local system CLI SHALL reserve only `--help` as the non-JSON marker
The `attention`, `message`, `workspace`, and `terminal` commands SHALL treat `--help` and `--compact` as the only reserved non-JSON argv markers. Short aliases such as `-h`, bare `help`, or `--arg=value`-style positional forms SHALL NOT become alternate parsing modes.

#### Scenario: Canonical help stays on `--help`
- **WHEN** the AI runs `message --help`
- **THEN** the runtime returns local schema-backed help without calling the runtime API
- **AND** the canonical examples stay JSON-first

#### Scenario: Compact mode is explicit
- **WHEN** the AI wants to send a compact payload such as `[0,[\"term-1\"]]`
- **THEN** it must pass `--compact`
- **AND** the runtime does not auto-detect ordinary JSON arrays as compact payloads without that marker

#### Scenario: Non-canonical help alias is rejected as ordinary argv
- **WHEN** the AI runs `message -h`
- **THEN** the runtime treats `-h` as an ordinary token instead of a help alias
- **AND** the command fails through the normal JSON-only CLI rules

### Requirement: Runtime skills SHALL require terminal plus exact-path verification before delivery announcements
Built-in runtime skills SHALL teach that `terminal write` only delivers input, that terminal state alone does not prove a service is reachable, and that the exact promised URL or path must be freshly verified from root workspace bash before any room-visible delivery message is sent.

#### Scenario: Built-in runtime skills teach durable delivery verification
- **WHEN** the runtime writes built-in skills for shell-visible systems
- **THEN** the terminal/runtime skill content explains that `terminal write` only submits input
- **AND** the skill content instructs the AI to `terminal read` and then externally verify the promised URL before sending a room delivery message

#### Scenario: Delivery announcement happens only after terminal and curl verification
- **GIVEN** an avatar is launching a durable local service for another room participant
- **WHEN** the AI follows the built-in runtime skills
- **THEN** it first launches or recovers the service through `terminal`
- **AND** it reads terminal output to confirm the process did not immediately fail
- **AND** it verifies the exact promised URL from a fresh root workspace shell check before announcing delivery in the room

### Requirement: Runtime skills SHALL treat exact local URL host binding as delivery truth
When a room-visible delivery contract names a concrete local URL, the runtime skill surface SHALL treat that exact host and port as part of the promised fact rather than as interchangeable implementation details.

#### Scenario: Alternate localhost hosts do not satisfy a promised 127.0.0.1 URL
- **GIVEN** the promised delivery URL is `http://127.0.0.1:<port>/`
- **WHEN** the AI verifies `http://[::1]:<port>/` or `http://localhost:<port>/` successfully but the promised `http://127.0.0.1:<port>/` still fails
- **THEN** the runtime skills describe that situation as a failed delivery verification
- **AND** the AI is instructed to rebind or restart the service instead of announcing the room URL

#### Scenario: Built-in terminal skills show explicit bind examples for exact-host delivery
- **WHEN** the AI expands the built-in terminal/runtime skills for local service delivery
- **THEN** the examples include explicit bind forms such as `python3 -m http.server <port> --bind 127.0.0.1`
- **AND** the guidance states that the promised host must be verified exactly before `APP-URL:` / `PROJECT-URL:` is sent

### Requirement: Runtime skills SHALL teach shared-room single-source-of-truth collaboration
Built-in collaboration skills SHALL teach role boundaries, single-source ownership, and correction-first behavior for shared-room work.

#### Scenario: Collaboration guidance reinforces single-source room ownership
- **WHEN** the runtime renders the built-in collaboration skill surface
- **THEN** that guidance explains that shared-room contracts need a single owner
- **AND** invalid durable room messages must be replaced with corrected replies instead of defended as final truth

### Requirement: Runtime-local attention commit SHALL preserve done semantics across tool surfaces
When a runtime-local attention commit request marks a context as done without explicit score overrides, the runtime SHALL resolve that context's current active score keys to zero before persisting the commit.

#### Scenario: Done resolves active scores even through CLI/API
- **GIVEN** context `ctx-chat-main` currently has unresolved attention scores
- **WHEN** the runtime-local API receives an `attention commit` request with `contextId=ctx-chat-main`, `summary="done"`, `done=true`, and no explicit `scores`
- **THEN** the persisted commit sets each active score key in that context to `0`
- **AND** the context is no longer returned as active attention work
