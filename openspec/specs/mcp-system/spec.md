# mcp-system Specification

## Purpose

Define the Avatar-owned MCP system for global MCP configs, exact-project enablement, protocol transport lifecycle, project-local snapshots, SQL query, and explicit MCP tool invocation facts.

## Requirements

### Requirement: MCP system SHALL own global configs separately from project enablement

The MCP system SHALL maintain MCP global configs as reusable command/transport declarations under Avatar-owned persistent storage and SHALL maintain project enablement as durable records that mark which exact project paths may use which global MCP names. `mcp add` and `mcp remove` SHALL operate only on global configs. `mcp enable` and `mcp disable` SHALL operate on project enablement.

#### Scenario: Global add does not enable or start any project

- **WHEN** an operator adds an MCP global config
- **THEN** the config is persisted in the mcpSystem global registry
- **AND** no MCP instance is started for any project
- **AND** no project is enabled for that global MCP

#### Scenario: Global add rejects silent replacement for the same id

- **GIVEN** global MCP `fs` already exists
- **WHEN** an operator adds global MCP `fs` again without `override: true`
- **THEN** mcpSystem rejects the request as a name conflict
- **AND** the existing global config remains unchanged

#### Scenario: Global add can explicitly override the same id

- **GIVEN** global MCP `fs` already exists
- **WHEN** an operator adds global MCP `fs` again with `override: true`
- **THEN** mcpSystem replaces the stored global config bound to id `fs`
- **AND** existing exact-project enablement and instance identity for `fs` stay attached to that id

#### Scenario: Global remove does not target one project

- **GIVEN** global MCP `fs` exists
- **WHEN** an operator removes global MCP `fs`
- **THEN** mcpSystem treats the command as global config deletion
- **AND** it does not infer a project target from the caller context

#### Scenario: Global remove defaults to no process stopping

- **GIVEN** global MCP `fs` has a running instance in project `/repo/app`
- **WHEN** an operator removes global MCP `fs` without `stop`
- **THEN** mcpSystem uses `stop: false`
- **AND** rejects the removal because a running project instance still exists
- **AND** the global config remains unchanged

#### Scenario: Global remove can explicitly stop running instances

- **GIVEN** global MCP `fs` has running instances in projects `/repo/a` and `/repo/b`
- **WHEN** an operator removes global MCP `fs` with `stop: true`
- **THEN** mcpSystem stops those project instances before removing the global config
- **AND** revokes active project enablement records for `fs`

#### Scenario: Project enablement uses an installed global

- **GIVEN** global MCP `fs` has been added
- **WHEN** an operator enables `fs` for exact project path `/repo/app`
- **THEN** mcpSystem persists project enablement for `fs` and `/repo/app`
- **AND** the enablement remains queryable even when no live MCP session is running

### Requirement: MCP globals SHALL be disabled by default in every project

The MCP system SHALL treat global existence as inert. A newly added global MCP SHALL be reported as disabled for a project until that project explicitly enables it or a caller explicitly opts into auto-enable behavior.

#### Scenario: Added global appears disabled in project SQL projection

- **GIVEN** global MCP `fs` has been added
- **AND** project `/repo/app` has never enabled `fs`
- **WHEN** the caller runs `mcp query` with `projectPath: "/repo/app"` and SQL selecting `fs` from project rows
- **THEN** the result includes global MCP `fs`
- **AND** the projected project status is `enabled = 0`
- **AND** `enabled_source` is `default`
- **AND** no live MCP session is running for that project/global pair

#### Scenario: Project list excludes disabled globals

- **GIVEN** global MCP `fs` has been added
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the caller lists MCPs for project `/repo/app`
- **THEN** the result does not include `fs`

### Requirement: MCP project list SHALL show enabled project MCPs with available overview

The MCP system SHALL expose `mcp list` as a project-facing command that lists only enabled MCPs for an exact project path. The result SHALL include global description fields, lifecycle state, and the latest project-local snapshot when available.

#### Scenario: Project list includes enabled MCP with no snapshot

- **GIVEN** global MCP `fs` has been enabled for project `/repo/app`
- **AND** the project/global pair has never started successfully
- **WHEN** the caller runs `mcp list` for `/repo/app`
- **THEN** the result includes `fs`
- **AND** includes global title or description when configured
- **AND** reports no snapshot for that project/global pair

#### Scenario: Project list shows latest stopped snapshot

- **GIVEN** global MCP `fs` has been enabled for project `/repo/app`
- **AND** `fs` previously started successfully and discovered tool `read_file`
- **AND** the live session is now stopped
- **WHEN** the caller runs `mcp list` for `/repo/app`
- **THEN** the result includes `fs`
- **AND** reports lifecycle state `stopped`
- **AND** includes the latest project-local snapshot containing `read_file`

### Requirement: MCP system SHALL use SQLite as the durable fact store and query substrate

The MCP system SHALL persist global configs, project enablement, live instance recovery state, snapshots, and action facts in avatar-private SQLite storage under Avatar-owned MCP authority. Query surfaces SHALL read from SQLite-backed facts rather than from a separate ad-hoc JSON registry.

#### Scenario: MCP facts survive runtime restart

- **GIVEN** global MCP `fs` has been added and enabled for project `/repo/app`
- **AND** `fs` has a latest project-local snapshot
- **WHEN** the runtime process restarts
- **THEN** mcpSystem reloads the global config, project enablement, and snapshot from SQLite
- **AND** live process state is recovered as stopped or unknown unless a reusable remote session can be health-checked

#### Scenario: SQL query reads the same durable facts as list and lifecycle commands

- **GIVEN** global MCP `fs` is enabled for project `/repo/app`
- **WHEN** the caller runs `mcp list` for `/repo/app`
- **AND** runs `mcp query` against the `mcp_enabled` table for enabled project rows
- **THEN** both surfaces agree that `fs` is enabled for `/repo/app`

### Requirement: MCP system SHALL support protocol transport adapters

The MCP system SHALL model MCP transport as an adapter selected by global config. The first implementation MUST support stdio, Streamable HTTP, and SSE through official MCP SDK client transports without changing the instance lifecycle contract.

#### Scenario: Stdio global starts a local process

- **GIVEN** an installed global config declares the `stdio` transport and a command argv
- **AND** the global is enabled for project `/repo/app`
- **WHEN** mcpSystem starts it for `/repo/app`
- **THEN** it launches the configured MCP server process with that project path as the instance working path
- **AND** it initializes the MCP client session through the stdio transport adapter

#### Scenario: Remote global starts through an HTTP transport adapter

- **GIVEN** an installed global config declares a remote MCP transport endpoint
- **AND** the global is enabled for project `/repo/app`
- **WHEN** mcpSystem starts it for `/repo/app`
- **THEN** it initializes the MCP client session through the configured remote transport adapter
- **AND** the rest of the instance lifecycle remains the same as a stdio instance

#### Scenario: SSE global starts through the SSE transport adapter

- **GIVEN** an installed global config declares the `sse` transport and endpoint headers
- **AND** the global is enabled for project `/repo/app`
- **WHEN** mcpSystem starts it for `/repo/app`
- **THEN** it initializes the MCP client session through the official SDK SSE client transport
- **AND** records discovery snapshots and lifecycle state under the exact project/global pair

### Requirement: MCP stdio environment SHALL come from root-workspace runtime env plus literal overlays

The MCP system SHALL resolve stdio process environment from root-workspace runtime env overlaid by literal global config env and literal transport env. This change SHALL NOT introduce a separate secret-reference system; credentials and private environment authority belong to the avatar-private root-workspace runtime env.

#### Scenario: Global env overlays root runtime env

- **GIVEN** root-workspace runtime env contains `TOKEN=root-token`
- **AND** global MCP `fs` config contains literal env `TOKEN=global-token`
- **AND** stdio transport env contains literal env `MODE=project`
- **WHEN** mcpSystem starts `fs` for project `/repo/app`
- **THEN** the spawned MCP server process receives `TOKEN=global-token`
- **AND** receives `MODE=project`
- **AND** no secret-reference resolver is required for the start operation

### Requirement: MCP probe SHALL allow CLI-backed isolated draft transport sessions

The MCP system SHALL expose an `mcp probe` operation that can open an isolated MCP client session for a draft transport config, discover server capabilities, ping the server, call tools, read resources, get prompts, request completions, and close the probe without persisting a global config, project enablement, durable live instance, snapshot, or action fact. This surface exists for lightweight pre-install inspection and SHALL remain orthogonal to durable MCP truth. The legacy inspect operation MAY remain as a compatibility projection, but Studio lightweight inspection SHALL mirror `mcp probe` capabilities instead of inventing GUI-only MCP actions.

#### Scenario: Probe open returns a connection snapshot without install

- **WHEN** the caller opens a probe for a draft MCP transport that has not been added globally
- **THEN** mcpSystem connects with the same transport and environment resolution law used by normal start
- **AND** returns a CLI-shaped result containing `command`, `stdin`, `stdout`, `stderr`, `exitCode`, and parsed JSON with `probeId`
- **AND** the parsed snapshot contains server identity plus tools, resources, resource templates, prompts, and MCP app resources when reported by the protocol
- **AND** no global config, project enablement, durable live instance record, snapshot row, or action fact is persisted

#### Scenario: Probe actions reuse one isolated client

- **GIVEN** a probe has been opened for a draft transport
- **WHEN** the caller uses the returned `probeId` to ping, call one tool, read one resource, get one prompt, or request completion
- **THEN** mcpSystem uses the same isolated MCP client session
- **AND** each action returns the same CLI-shaped result envelope
- **AND** closing the probe releases that isolated session without promoting it into durable instance truth

### Requirement: MCP live sessions SHALL be locked by explicit project and global

Each MCP live session SHALL be uniquely keyed by installed global MCP name and explicit project path. Project path matching MUST be exact after path normalization; parent and child paths MUST NOT inherit or share enablement, sessions, or snapshots unless the caller passes the exact same project path.

#### Scenario: Same global and project reuse one instance

- **GIVEN** global MCP `github` has an enabled running session for `/repo/app`
- **WHEN** a later MCP command uses global MCP `github` with project `/repo/app`
- **THEN** mcpSystem reuses the existing instance
- **AND** it does not start a second MCP client session for the same key

#### Scenario: Parent and child project paths do not inherit enablement or instances

- **GIVEN** global MCP `github` is enabled and running for `/repo`
- **WHEN** a later MCP command uses global MCP `github` with project `/repo/app`
- **THEN** mcpSystem treats `/repo/app` as a distinct project scope
- **AND** it does not reuse `/repo` enablement or live session by parent-path inheritance

### Requirement: MCP call SHALL honor autoStart and autoEnable gates

Every MCP call SHALL require an explicit project path and global MCP name. Calls SHALL default to `autoStart: true` and `autoEnable: false`. A call MAY start a stopped enabled project instance automatically, but it MUST NOT enable a disabled project/global pair unless the caller explicitly sets `autoEnable: true`.

#### Scenario: Call auto-starts enabled stopped instance by default

- **GIVEN** global MCP `fs` is enabled for project `/repo/app`
- **AND** no live session is running for `/repo/app`
- **WHEN** the caller invokes an MCP tool through global MCP `fs` and project `/repo/app`
- **THEN** mcpSystem starts the `/repo/app` instance before issuing the tool call
- **AND** the caller receives either the tool result or the startup/tool failure as one command result

#### Scenario: Call rejects disabled project by default

- **GIVEN** global MCP `fs` is installed but not enabled for project `/repo/app`
- **WHEN** the caller invokes an MCP tool through global MCP `fs` and project `/repo/app`
- **THEN** mcpSystem rejects the request with an enable-oriented error
- **AND** it does not create project enablement implicitly

#### Scenario: Call can explicitly auto-enable

- **GIVEN** global MCP `fs` exists
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the caller invokes an MCP tool with `autoEnable: true`
- **THEN** mcpSystem enables `fs` for `/repo/app`
- **AND** then applies the `autoStart` behavior before invoking the tool

#### Scenario: Call can require pre-started instance

- **GIVEN** global MCP `fs` is enabled for project `/repo/app`
- **AND** no live session is running for `/repo/app`
- **WHEN** the caller invokes an MCP tool with `autoStart: false`
- **THEN** mcpSystem rejects the request with a start-oriented error
- **AND** it does not start the MCP process

### Requirement: MCP system SHALL provide manual project lifecycle controls

The MCP system SHALL provide explicit start, stop, and restart operations for project-scoped instances so callers can release resources or recover from abnormal MCP server state. Lifecycle controls SHALL require the global MCP to be enabled for the exact project.

#### Scenario: Start requires project enablement

- **GIVEN** global MCP `fs` exists
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the caller starts `fs` for `/repo/app`
- **THEN** mcpSystem rejects the request with an enable-oriented error
- **AND** it does not start an MCP process

#### Scenario: Stop releases a running instance

- **GIVEN** an MCP instance is running for global MCP `fs` and project `/repo/app`
- **WHEN** the caller stops that instance
- **THEN** mcpSystem closes the MCP client session
- **AND** it terminates or disconnects the underlying transport resources owned by that instance
- **AND** the instance record remains inspectable as stopped

#### Scenario: Restart replaces the live session

- **GIVEN** an MCP instance is running for global MCP `fs` and project `/repo/app`
- **WHEN** the caller restarts that instance
- **THEN** mcpSystem stops the current session
- **AND** starts a fresh session from the same global config and project path
- **AND** records a new discovery snapshot after successful initialization

### Requirement: MCP disable SHALL revoke project availability

The MCP system SHALL provide `mcp disable` to mark a project/global pair unavailable for calls and lifecycle starts. The first implementation SHALL stop a running instance by default when disabling unless the caller passes `stop: false`.

#### Scenario: Disable prevents later calls

- **GIVEN** global MCP `fs` is enabled for project `/repo/app`
- **WHEN** the caller disables `fs` for `/repo/app`
- **THEN** the project status becomes `enabled: false`
- **AND** later calls with default `autoEnable: false` are rejected

#### Scenario: Disable stops running instance by default

- **GIVEN** global MCP `fs` is enabled and running for project `/repo/app`
- **WHEN** the caller disables `fs` for `/repo/app`
- **THEN** mcpSystem applies default `stop: true`
- **AND** stops the running project instance
- **AND** the latest project-local snapshot remains available for query diagnostics

#### Scenario: Disable can preserve the current process when requested

- **GIVEN** global MCP `fs` is enabled and running for project `/repo/app`
- **WHEN** the caller disables `fs` for `/repo/app` with `stop: false`
- **THEN** mcpSystem marks the project/global pair disabled
- **AND** does not stop the current process as part of the disable operation

### Requirement: MCP system SHALL publish latest capability snapshots from initialized instances

After a successful MCP initialization, the system SHALL persist a latest capability snapshot containing server identity and discovered tools, resources, and prompts for that exact project/global pair. Global overview MAY aggregate these snapshots as references, but each snapshot MUST remain project-local and MUST NOT mutate global config truth.

#### Scenario: Initialized instance records command overview

- **WHEN** an MCP instance finishes initialization and discovery
- **THEN** mcpSystem stores the latest server info and discovered command-capability overview for that exact project/global pair
- **AND** global overview can display that snapshot as project-scoped reference information

#### Scenario: Project snapshots are not shared

- **GIVEN** global MCP `fs` has a latest snapshot for project `/repo/a`
- **AND** global MCP `fs` is also enabled for project `/repo/b` with no successful startup snapshot
- **WHEN** the caller queries `/repo/b`
- **THEN** mcpSystem does not use `/repo/a`'s snapshot as `/repo/b`'s description
- **AND** `/repo/b` is reported without a project-local snapshot

#### Scenario: Global truth is not rewritten by discovery

- **GIVEN** a global config declares command argv and transport config
- **WHEN** an instance discovers tools or resources after initialization
- **THEN** the discovered capabilities are stored as instance snapshot projection
- **AND** the global command and transport config remain unchanged

### Requirement: MCP query SHALL expose a read-only SQL surface

The MCP system SHALL expose `mcp query` as a read-only SQL surface over documented temporary tables named `mcp_installed` and `mcp_enabled`. The surface SHALL accept caller SQL and named parameters, map durable SQLite facts into those temporary tables, execute only allowed read-only statements, and always return JSON rows.

#### Scenario: Query help exposes table schema

- **WHEN** the caller runs `mcp query --help`
- **THEN** the help output includes the `mcp_installed` and `mcp_enabled` temporary table columns
- **AND** includes examples for global inventory, project enabled list, default-disabled check, running instances, and snapshot JSON search
- **AND** states that query execution returns JSON rows only

#### Scenario: Query returns JSON rows

- **GIVEN** global MCP `fs` has been added
- **WHEN** the caller runs `mcp query` selecting `name` from `mcp_installed`
- **THEN** the command result contains a JSON array of row objects
- **AND** it does not switch to table or plain-text output based on terminal context

#### Scenario: Query rejects mutating SQL

- **WHEN** the caller sends SQL containing `UPDATE mcp_enabled SET enabled = 1`
- **THEN** mcpSystem rejects the query before execution
- **AND** no durable MCP facts are changed

#### Scenario: Query supports project-local default disabled projection in enabled table

- **GIVEN** global MCP `fs` has been added
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the caller runs `mcp query` with `projectPath: "/repo/app"` and SQL selecting project rows for `fs`
- **THEN** the temporary `mcp_enabled` table contains a row for `fs`
- **AND** that row has `enabled = 0` and `enabled_source = 'default'`

#### Scenario: Query without projectPath does not invent unknown project rows

- **GIVEN** global MCP `fs` has been added
- **WHEN** the caller runs `mcp query` without `projectPath`
- **THEN** the temporary `mcp_installed` table includes the active global row for `fs`
- **AND** does not create default-disabled project rows for unknown project paths

#### Scenario: Snapshot JSON is project-local evidence

- **GIVEN** global MCP `fs` is enabled for `/repo/a` and `/repo/b`
- **AND** only `/repo/a` has a latest snapshot containing tool `read_file`
- **WHEN** the caller queries `mcp_enabled` rows for snapshot JSON containing `read_file`
- **THEN** the result includes the `/repo/a` row
- **AND** it does not claim that `/repo/b` has `read_file` until `/repo/b` has its own snapshot proving that capability

### Requirement: MCP system SHALL keep invocation effects attributable

Every MCP tool invocation SHALL be supported in the first implementation through `mcp call` and SHALL be recorded as an explicit action/effect fact with global MCP name, project path, instance id when running, MCP tool name, input summary, autoStart/autoEnable decisions, result status, and error details when available. MCP invocation MUST NOT appear as hidden provider-side tool work without a runtime action source.

#### Scenario: MCP call records action source

- **WHEN** the caller invokes an MCP tool through mcpSystem
- **THEN** the runtime can trace the action to the caller, global MCP name, project path, autoStart/autoEnable decisions, and MCP instance
- **AND** success or failure is visible as the result of that explicit mcpSystem action

### Requirement: MCP implementation SHALL pass real-AI acceptance against real MCP servers

Before this change is archived, the implemented MCP system SHALL be exercised by a real AI agent using only root-workspace `mcp` CLI commands, `mcp <command> --help`, and the bundled MCP skill guidance. The acceptance SHALL use `@modelcontextprotocol/server-sequential-thinking` as the stdio MCP server and SHALL use an SDK-backed SSE MCP server fixture or another reviewed reliable SSE MCP server as the SSE target.

#### Scenario: Real AI uses sequential-thinking over stdio

- **GIVEN** `@modelcontextprotocol/server-sequential-thinking` is configured as a global stdio MCP
- **AND** the global is enabled for a concrete project path
- **WHEN** a real AI agent follows MCP skill/help guidance to list, query, and call the sequential-thinking tool
- **THEN** the call succeeds through mcpSystem
- **AND** mcpSystem records the project-local snapshot and invocation action facts

#### Scenario: Real AI uses an SSE MCP server

- **GIVEN** a reliable SSE MCP server fixture is configured as a global `sse` MCP
- **AND** the global is enabled for a concrete project path
- **WHEN** a real AI agent follows MCP skill/help guidance to list, query, start, call, and stop that MCP
- **THEN** the SSE client transport initializes and calls successfully through mcpSystem
- **AND** mcpSystem records lifecycle state, project-local snapshot, and invocation action facts for the exact project/global pair
