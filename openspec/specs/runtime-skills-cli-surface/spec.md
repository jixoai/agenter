# runtime-skills-cli-surface Specification

## Purpose
Define the runtime's explicit workspace tool surface, progressive skill discovery model, and attention-scoped CLI/API laws.
## Requirements
### Requirement: Runtime SHALL expose explicit workspace primitives as model tools

Each AI model round SHALL receive `workspace_list`, `root_bash`, and `workspace_bash` as the only direct tools. Message, terminal, workspace, MCP, and attention system operations SHALL be performed through CLI commands inside `root_bash` instead of through direct model tool injection. `root_bash` SHALL execute as the fixed `root-workspace` shell surface on top of one session-owned durable root-workspace `just-bash` world and MAY rewrite `HOME` to the avatar root workspace while mounting runtime CLI projected from workspace capability env such as `AVATAR_HOME` and `SKILLS_HOME`. `workspace_bash` SHALL stay a `public-workspace` shell selected by `workspaceId` and SHALL NOT synthesize avatar-root `HOME` or mount runtime-local CLI helpers merely because the project workspace is mounted.

#### Scenario: Model receives only the explicit workspace direct tools
- **WHEN** the runtime prepares a model call
- **THEN** the direct tool list contains `workspace_list`, `root_bash`, and `workspace_bash`
- **AND** it does not include `attention_*`, `message_*`, `terminal_*`, or `mcp_*` direct tools

#### Scenario: Root bash keeps avatar-root home semantics
- **WHEN** the AI executes `root_bash`
- **THEN** the shell runs inside the fixed avatar-root workspace
- **AND** `HOME` resolves to that avatar-root workspace

#### Scenario: Root bash exposes projected runtime CLI
- **WHEN** the AI executes `root_bash`
- **THEN** runtime-local CLI commands such as `attention`, `message`, `workspace`, `terminal`, `mcp`, `skill`, `note`, and `tool` are available when projected for that workspace instance
- **AND** those commands are explained by root-workspace capability env rather than by direct model tool injection

#### Scenario: Workspace bash does not inherit root-workspace semantics
- **WHEN** the AI executes `workspace_bash` for a mounted project workspace
- **THEN** the shell runs with that workspace authority and selected cwd
- **AND** the runtime does not silently rewrite `HOME` to the avatar-root workspace
- **AND** runtime-local CLI helpers are not mounted inside that shell merely because the project workspace is attached

#### Scenario: Root bash executes on one durable root-workspace world
- **WHEN** the AI executes `root_bash` repeatedly in one runtime session
- **THEN** those calls reuse one session-owned durable root-workspace `just-bash` world
- **AND** each call still gets one isolated shell session state on top of that shared world

#### Scenario: Root bash refreshes visible mounts without losing durable world state
- **GIVEN** the runtime already has a durable root-workspace shell world
- **WHEN** mounted workspaces or runtime-visible skill roots change before a later `root_bash` call
- **THEN** the later `root_bash` call sees the refreshed mount surface
- **AND** the runtime does not replace the root-workspace shell host just to pick up that change

### Requirement: Runtime SHALL publish an attention-backed skills list for progressive discovery

Each AI model round SHALL include a lightweight attention-backed `skills.list` summary built from runtime-visible skill sources. The summary SHALL live in the runtime skill context's readonly slot, include discovery metadata only, and leave detailed instructions and examples available through CLI-driven expansion.

#### Scenario: Skills list reflects SKILLS_HOME-visible sources only
- **WHEN** the runtime builds `skills.list` for avatar `principal-123`
- **THEN** it includes skills visible from the current workspace `SKILLS_HOME` source order plus indexed built-ins
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

### Requirement: Root bash SHALL expose projected runtime CLI commands in-shell

The shell environment behind `root_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `mcp`, `tool`, and any projected system CLIs such as `skill` and `note`.

#### Scenario: Shell exposes CLI commands as normal command names
- **WHEN** the AI runs `which attention`, `which workspace`, `which mcp`, or `which skill` inside `root_bash`
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

The `message`, `terminal`, and `attention commit` CLI commands exposed inside `root_bash` SHALL accept JSON stdin payloads when the content is more natural to stream than to escape into argv.

#### Scenario: Terminal write accepts piped stdin
- **WHEN** the AI calls `root_bash` with `command="terminal write"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated terminal-write payload
- **AND** the runtime does not require the same JSON to be repeated inside argv

#### Scenario: Message send accepts piped stdin
- **WHEN** the AI calls `root_bash` with `command="message send"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated room-message payload
- **AND** the runtime preserves unix-style shell composition for multi-line message bodies

#### Scenario: Attention commit still accepts JSON stdin for full payload control
- **WHEN** the AI calls `root_bash` with `command="attention commit"` and a JSON payload in `stdin`
- **THEN** the runtime parses the JSON payload exactly
- **AND** shell tooling keeps the full JSON escape hatch for long-form settle flows

### Requirement: Runtime guidance SHALL default descriptor-backed JSON transport to stdin

Built-in runtime skills, references, and top-level runtime prompts SHALL teach that descriptor-backed runtime-local CLI commands use a minimal `root_bash.command` plus JSON `stdin` by default, while a single argv JSON payload remains only a compact fallback for trivially short requests. When `--compact` is available, guidance SHALL present it as an optional encoding surface, not as a replacement for standard object JSON.

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

When a runtime-local attention commit request marks a context as done without explicit score overrides, the runtime SHALL resolve that context's current active score keys to zero in the persisted commit ledger. The current context projection MAY prune those resolved keys from `scoreMap` as long as the context no longer presents them as active unresolved work.

#### Scenario: Done resolves active scores even through CLI/API
- **GIVEN** context `ctx-chat-main` currently has unresolved attention scores
- **WHEN** the runtime-local API receives an `attention commit` request with `contextId=ctx-chat-main`, `summary="done"`, `done=true`, and no explicit `scores`
- **THEN** the persisted commit sets each active score key in that context to `0`
- **AND** the context is no longer returned as active attention work
- **AND** the current context projection does not need to retain zero-valued keys in `scoreMap`

### Requirement: Runtime terminal skills SHALL teach await as the bounded observation primitive

Built-in terminal guidance SHALL teach `terminal await` as the default active observation primitive when the AI needs to wait for terminal output, idle state, or deterministic text evidence. The guidance SHALL keep `terminal read` framed as immediate inspection and SHALL discourage reconstructing bounded observation through `sleep && terminal read | grep`.

#### Scenario: Terminal skill replaces sleep-read-grep guidance
- **WHEN** the runtime renders the built-in terminal skill
- **THEN** the guidance instructs the AI to use `terminal await` for bounded wait-for-evidence flows
- **AND** it does not teach `sleep && terminal read | grep` as the normal strategy for waiting on terminal state

#### Scenario: Terminal skill preserves immediate read guidance
- **WHEN** the runtime renders the built-in terminal skill
- **THEN** the guidance continues to describe `terminal read` as the immediate terminal inspection command
- **AND** it distinguishes immediate inspection from long-running await observation

#### Scenario: Terminal skill teaches snapshot lines as evidence
- **WHEN** the runtime renders guidance for `terminal await`
- **THEN** the guidance explains that await returns clean bounded snapshot lines and match context
- **AND** it explains that those lines are terminal canvas evidence rather than raw ANSI bytes

#### Scenario: Terminal skill teaches signal-safe bounded waits
- **WHEN** the runtime renders guidance for long-running terminal observation
- **THEN** it tells the AI to prefer the command-level timeout in `terminal await`
- **AND** it explains that shell-level timeout may still cancel the command and must not be relied on for post-mortem evidence

### Requirement: Built-in terminal skill SHALL teach explicit lifecycle control
The built-in `agenter-terminal` skill and its lifecycle references SHALL teach runtime terminal lifecycle through `create or recover`, `bootstrap`, `read`, `write/input`, `stop`, `history`, `archive`, and `delete`. The guidance SHALL describe `stop` as the live-to-history transition and SHALL reserve `delete` for final destructive removal.

#### Scenario: Terminal skill teaches bootstrap before not-started terminal work
- **WHEN** the runtime renders the built-in terminal skill for a not-started terminal workflow
- **THEN** the guidance instructs the caller to inspect `terminal list` and use `terminal bootstrap` before expecting read/write to work
- **AND** it does not imply that opening or reading the terminal will auto-start the PTY

#### Scenario: Terminal skill distinguishes stop, history, and delete semantics
- **WHEN** the runtime renders lifecycle guidance for terminal shutdown and cleanup
- **THEN** the skill explains that `terminal stop` halts the PTY and moves the instance into history
- **AND** it explains that `terminal history` is the place to inspect dead-instance evidence
- **AND** it explains that `terminal delete` is the final destructive removal path

### Requirement: Built-in terminal skills SHALL teach transition-aware lifecycle law
Built-in runtime terminal skill guidance and lifecycle references SHALL teach the current create/bootstrap/stop/history law, including the fact that dead terminals leave the default live list.

#### Scenario: Terminal skill teaches create auto-bootstrap
- **WHEN** the runtime renders the built-in `agenter-terminal` skill
- **THEN** the guidance explains that `terminal create` auto-bootstraps new terminals by default
- **AND** the caller is not told to run a redundant second bootstrap for a freshly created terminal unless the create result still shows a transition or not-started state

#### Scenario: Terminal skill teaches dead terminals are history-only
- **WHEN** the runtime renders lifecycle recovery guidance for an existing terminal that has already been killed
- **THEN** the guidance tells the AI to use `terminal history` to inspect it
- **AND** it does not teach the AI that the dead terminal remains part of the normal `terminal list`

#### Scenario: Terminal skill teaches transition wait instead of mutation stacking
- **WHEN** the runtime renders lifecycle guidance for a terminal whose `lifecycleTransition` is `bootstrapping` or `killing`
- **THEN** the guidance tells the AI to wait and reread lifecycle state
- **AND** it does not teach the AI to stack another bootstrap or stop command on top of the in-flight mutation

### Requirement: Built-in terminal skills SHALL expose config inspection and mutation guidance

Built-in terminal skill guidance SHALL teach `terminal get-config` and `terminal set-config` as the canonical shell-facing surface for durable launch truth.

#### Scenario: Terminal skill teaches get-config and set-config

- **WHEN** the runtime renders the built-in `agenter-terminal` skill and references
- **THEN** the guidance tells the AI to use `terminal get-config` when it needs the durable launch command, default cwd, title, geometry, or metadata
- **AND** it tells the AI to use `terminal set-config` when it needs to update those durable terminal defaults without recreating the terminal id

### Requirement: Runtime-local message send SHALL expose object-JSON follow-up reminder intent

The runtime-local `message send` command SHALL accept an optional positive integer `followUpAfterMs` on the standard object JSON payload. Help text and built-in skill guidance SHALL describe this field as a one-shot reminder that later creates attention only if the sent message still represents the latest visible room state. The runtime SHALL not require a new compact positional encoding for this field in this change.

#### Scenario: Object JSON send accepts `followUpAfterMs`

- **WHEN** the AI runs `root_bash` with `command="message send"` and JSON `stdin` containing `chatId`, `content`, and `followUpAfterMs`
- **THEN** the runtime validates that payload and dispatches the room send successfully
- **AND** the reminder intent rides on the object JSON request without altering the visible room payload schema

#### Scenario: Invalid `followUpAfterMs` is rejected before send

- **WHEN** the AI sends `message send` object JSON with a non-integer or non-positive `followUpAfterMs`
- **THEN** the runtime rejects that payload through normal descriptor validation
- **AND** no durable room message is appended

#### Scenario: Help explains that follow-up reminder is not auto-reply

- **WHEN** the AI runs `message send --help`
- **THEN** the help surface documents `followUpAfterMs`
- **AND** the help explains that due expiry creates a later attention item instead of an automatic visible room message

#### Scenario: Reminder callers stay on object JSON instead of compact positional mode

- **WHEN** the AI wants to send a room message with `followUpAfterMs`
- **THEN** the documented supported surface is the standard object JSON payload
- **AND** the runtime does not require a new compact positional slot in order to use the reminder

### Requirement: Root bash SHALL expose dedicated seat-management commands as frontend clients for shared resources

The root-workspace shell surface SHALL expose `terminal-manage` and `message-manage` as dedicated JSON-first command helpers for manager-authorized seat operations. These commands SHALL act as frontend clients of the corresponding system backend and SHALL coexist with `terminal` and `message` instead of overloading their existing inspection or communication verbs.

#### Scenario: Root shell discovers dedicated manage commands

- **WHEN** the AI or operator runs `which terminal-manage` or `which message-manage` inside `root_bash`
- **THEN** each command is discoverable and executable from that shell session
- **THEN** `terminal` and `message` remain available for their existing inspection and communication contracts

#### Scenario: Manage command uses backend authority rather than direct local mutation

- **WHEN** `terminal-manage` or `message-manage` performs invite, accept, config, or revoke
- **THEN** the command talks to the corresponding system backend through endpoint, token, and proof-bearing requests
- **THEN** the command is not treated as the durable owner of terminal or room truth

#### Scenario: Invite returns a share descriptor instead of a live access token

- **WHEN** `terminal-manage invite` or `message-manage invite` succeeds
- **THEN** the command returns the opaque invitation token plus deep-link or HTTP share descriptors
- **THEN** the command does not pretend that the invited principal already has active resource authority

### Requirement: Seat-management CLI SHALL share acceptance mechanics without forcing one permission grammar

The dedicated management CLI SHALL share descriptor parsing and acceptance mechanics across resources without forcing one universal permission grammar. `accept` SHALL accept a raw token, a deep link, or an HTTP wrapper URL. When invoked from `root_bash`, `accept` SHALL sign with the injected runtime principal private key before submitting the acceptance proof. Resource-specific invite/config commands SHALL remain free to expose their own authority vocabulary.

#### Scenario: Resource-specific authority grammar stays local

- **WHEN** an operator uses `terminal-manage invite` and `message-manage invite`
- **THEN** terminal-manage may expose terminal-native authority inputs such as `RO`, `RW`, or `TM`
- **THEN** message-manage first exposes direct room-native authority inputs `readonly`, `member`, and `admin`
- **THEN** the shared runtime CLI layer does not force both commands into one identical role dictionary

#### Scenario: Accept consumes any supported invitation descriptor

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` with a raw token, deep link, or HTTP wrapper URL
- **THEN** the command resolves all forms to the same invitation token
- **THEN** the resulting acceptance targets the same pending invitation fact

#### Scenario: Accept signs with the runtime principal key

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` from `root_bash`
- **THEN** the command signs the acceptance payload with the injected runtime principal private key
- **THEN** the control plane verifies the proof against the invited principal before activating the seat

#### Scenario: HTTP wrapper bootstrap still resolves to the same backend invitation

- **WHEN** a recipient opens an HTTP wrapper invitation link and hands it to `terminal-manage accept` or `message-manage accept`
- **THEN** the client resolves that link to the same backend invitation token used by deep links or raw tokens
- **THEN** the backend system remains the authority that validates and activates the invitation

#### Scenario: First implementation does not require a persistent preview page

- **WHEN** the delivery layer emits an HTTP wrapper invitation link
- **THEN** the link may resolve directly to token import or CLI handoff without requiring a durable invitation preview page
- **THEN** the acceptance still targets the same backend invitation fact

#### Scenario: Message-delivered descriptor preserves terminal invitation truth

- **WHEN** principal `A` posts a terminal invitation descriptor for principal `B` into a room that `B` can read
- **THEN** `B` can copy that raw token, deep link, or HTTP wrapper URL into `terminal-manage accept`
- **THEN** the acceptance still resolves to the original pending terminal invitation fact rather than minting a second invitation through message transport

#### Scenario: Cross-instance message transport can deliver terminal authority onboarding

- **WHEN** Avatar-A on agenter-A and Avatar-B on agenter-B already share a room hosted by one agenter endpoint
- **AND** Avatar-B sends Avatar-A a terminal invitation descriptor for a terminal hosted by agenter-B
- **THEN** Avatar-A can accept that descriptor from agenter-A without locally re-hosting the terminal authority
- **THEN** the acceptance still resolves against agenter-B's terminal backend as the authority that owns the invitation truth

### Requirement: Built-in terminal skill SHALL prefer clean terminal creation over killed reuse
The built-in terminal skill SHALL teach that killed terminals are dead evidence by default. For normal new work, the guidance SHALL prefer creating or selecting a live terminal instead of bootstrapping a killed terminal. Recovering a killed terminal SHALL be framed as explicit forensic or continuity recovery.

#### Scenario: Skill teaches killed terminals are not normal live candidates
- **WHEN** the runtime renders built-in terminal skill guidance
- **THEN** the guidance states that killed terminals leave `terminal list`
- **AND** it does not tell the AI to treat killed terminals as normal paused shells

#### Scenario: Skill prefers a clean terminal for normal work
- **WHEN** the AI needs an interactive terminal and the previous candidate is killed
- **THEN** the guidance tells the AI to create or select a live terminal for normal work
- **AND** it reserves killed recovery for an explicit user or operator intent

#### Scenario: Skill keeps history management explicit
- **WHEN** the guidance mentions killed terminal evidence
- **THEN** it points inspection to `terminal history` or terminal index surfaces
- **AND** it keeps archive and delete as explicit history-management actions
