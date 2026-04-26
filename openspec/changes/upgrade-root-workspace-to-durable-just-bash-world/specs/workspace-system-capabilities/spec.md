## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution
WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by the fixed avatar root workspace plus any currently granted dynamic workspaces. Root workspace bash and workspace bash SHALL both enforce path authority through a shared overlay-rule filesystem implementation. Dynamic workspace grants SHALL be evaluated as workspace-root-relative ordered glob patterns with default-deny and last-match-wins semantics. The shell SHALL use real absolute path semantics for mounted roots while still restricting access to mounted authorities only. `root_bash` SHALL execute against one session-owned durable `just-bash` world whose filesystem, mount graph, and command registry persist across calls. Each `root_bash` execution SHALL still start with isolated shell session state, and the implementation MUST NOT retain a legacy per-call root-workspace `Bash` construction path alongside the durable world.

#### Scenario: Root workspace bash uses real mounted paths
- **WHEN** the AI runs `pwd` or `ls` in root workspace bash
- **THEN** the shell reports the real absolute mount paths, such as `~/.agenter/avatars/<principal>` or an explicitly mounted project root
- **AND** it does not expose synthetic prompt-facing mount aliases such as `/workspace`

#### Scenario: Root workspace bash reuses one durable shell world
- **WHEN** the runtime executes `root_bash` multiple times in one session
- **THEN** those calls reuse one session-owned `just-bash` world for root-workspace execution
- **AND** the runtime does not rebuild a fresh root-workspace `Bash` host for every call

#### Scenario: Mounted workspace changes apply to later root shell executions without rebuilding the durable world
- **GIVEN** one runtime already has a durable root-workspace shell world
- **WHEN** the operator adds or removes one mounted project workspace for that runtime
- **THEN** a later root workspace shell execution sees the updated mount set
- **AND** the runtime does not need to replace the durable root-workspace `Bash` host to apply that change

#### Scenario: Updated rules apply to later shell executions without rebuilding the durable world
- **GIVEN** one runtime already has a workspace mounted through the shared overlay-rule filesystem
- **WHEN** the operator updates that workspace's grant rules or hidden private paths
- **THEN** a later shell execution sees the new readable and writable boundaries
- **AND** the runtime does not need a restart or root-world rebuild to apply the changed rules

#### Scenario: Runtime skill mount changes apply to later root shell executions without rebuilding the durable world
- **GIVEN** the runtime already has a durable root-workspace shell world
- **WHEN** runtime-visible skill roots change because skill files are added, removed, or refreshed
- **THEN** a later root workspace shell execution sees the updated read-only skill mount set
- **AND** the runtime does not replace the durable root-workspace `Bash` host just to pick up that skill change

#### Scenario: Unmounted paths remain inaccessible
- **WHEN** root workspace bash tries to access a filesystem path that is not the fixed avatar root workspace and is not under a currently granted workspace mount
- **THEN** the execution is rejected or the path is not found inside the shell sandbox
- **AND** the runtime does not silently widen filesystem authority

#### Scenario: Ungranted paths stay unreadable
- **GIVEN** a workspace mount grants `/src/**/*.ts` as read-only
- **WHEN** workspace bash or root workspace bash attempts to read `/docs/roadmap.md`
- **THEN** the read is rejected because no rule grants that path
- **AND** directory listings only expose paths that remain readable or traversable under the same rule set

#### Scenario: Avatar-private workspace paths stay isolated in shell access
- **GIVEN** two avatars mount the same workspace and each has its own private asset root under that workspace
- **WHEN** one avatar uses workspace bash or root workspace bash to inspect the other avatar's private subtree
- **THEN** the private subtree stays hidden or denied by the shared overlay-rule filesystem
- **AND** the current avatar can still access its own private subtree

#### Scenario: One-shot bash can verify loopback URLs like a terminal
- **WHEN** the runtime starts a local HTTP service on `127.0.0.1` through a granted terminal
- **THEN** `root_bash` can still verify that URL with one-shot network commands such as `curl`
- **AND** AI does not need to abandon the shell verification step just because the service is local

#### Scenario: Filesystem effects persist while shell session state does not
- **WHEN** the first root workspace bash execution creates a file and exports an environment variable
- **THEN** a later execution can read the created file through the same durable world
- **AND** the later execution does not inherit the previous shell environment, functions, or current working directory implicitly

#### Scenario: Workspace tools become callable command helpers
- **WHEN** a workspace public or avatar-private `tools/` directory contains an executable script with a supported shebang
- **THEN** WorkspaceSystem exposes that script through a `tool_*` command in workspace bash execution
- **AND** the command runs under the same workspace grant and sandbox rules as other workspace bash calls

#### Scenario: Transport failure stays a command failure
- **GIVEN** no process is listening on a loopback port
- **WHEN** root workspace bash runs `curl -s -o /dev/null -w "%{http_code}"` against that URL
- **THEN** the command exits non-zero
- **AND** stdout does not fabricate a successful-looking HTTP result such as `502`
- **AND** the command result preserves an AI-detectable failure signal, with `exitCode` as the minimum truth source even when curl is asked to stay silent

### Requirement: WorkspaceSystem SHALL distinguish `root-workspace` and `public-workspace` shell semantics
WorkspaceSystem SHALL treat the fixed avatar-root mount as the `root-workspace` shell surface and SHALL treat ordinary mounted project workspaces as `public-workspace` shell surfaces. `root-workspace` SHALL own one session-scoped durable shell world and MAY mount avatar-exclusive env and CLI helpers. `public-workspace` SHALL remain collaboration-oriented by default and SHALL NOT inherit root-workspace-exclusive env or CLI merely because the runtime also owns a root-workspace. A `public-workspace` MAY still contain avatar-private workspace asset roots inside its file tree; that does not change its shell semantics.

#### Scenario: Fixed avatar mount is the root-workspace surface
- **WHEN** a runtime starts
- **THEN** its fixed avatar-root mount is treated as `root-workspace`
- **AND** root-workspace-exclusive env or CLI is only legal on that shell surface by default

#### Scenario: Root-workspace owns one durable shell world
- **WHEN** the runtime serves repeated `root_bash` calls
- **THEN** those calls reuse the same root-workspace shell world for that runtime
- **AND** the durable root-workspace shell world does not change the collaboration semantics of other shell surfaces

#### Scenario: Mounted project workspace is a public-workspace surface
- **WHEN** a runtime mounts an ordinary project workspace
- **THEN** that mount is treated as a `public-workspace` shell surface
- **AND** the presence of workspace avatar-private subtrees does not upgrade it into `root-workspace`

#### Scenario: Public-workspace shell excludes root-exclusive CLI
- **WHEN** the operator or AI executes a shell against a `public-workspace`
- **THEN** root-workspace-exclusive CLI helpers are not auto-mounted into that shell
- **AND** the shell remains collaboration-safe by default

#### Scenario: Public-workspace shell keeps collaboration-oriented environment semantics
- **WHEN** the operator or AI executes a shell against a `public-workspace`
- **THEN** the runtime does not silently rewrite `HOME` to the avatar root workspace
- **AND** caller-provided environment semantics stay distinct from `root-workspace` defaults

#### Scenario: Shared terminal follows public-workspace semantics instead of root-workspace semantics
- **WHEN** a shared terminal is created or recovered for collaborative work
- **THEN** it follows the same collaboration-oriented env/CLI law as `public-workspace`
- **AND** the existence of a durable root-workspace shell world does not upgrade that terminal into `root-workspace`
