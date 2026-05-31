# workspace-system-capabilities Specification

## Purpose

Define WorkspaceSystem mounts, grants, asset roots, and non-interactive exec.

## Requirements

### Requirement: WorkspaceSystem SHALL manage dynamic mounts and path grants independent of Avatar definitions

The system SHALL model workspaces as independently mountable resources, while also attaching one fixed avatar root workspace for every runtime. Avatar runtimes SHALL receive project workspace access only through explicit workspace mounts and ordered grant rules, and the fixed avatar root workspace SHALL exist in addition to those dynamic mounts.

#### Scenario: Runtime always includes one fixed avatar root workspace

- **WHEN** an avatar runtime starts
- **THEN** WorkspaceSystem attaches the avatar's principal-address root workspace as a fixed mount
- **AND** that mount remains available even if no project workspace is currently attached

#### Scenario: Dynamic project workspaces remain explicit

- **WHEN** an avatar runtime needs access to a project workspace
- **THEN** that workspace still requires an explicit mount and grant set
- **AND** the fixed avatar root workspace does not implicitly grant access to unrelated project paths

#### Scenario: One Avatar runtime mounts multiple workspaces concurrently

- **WHEN** one Avatar runtime mounts two different workspaces at the same time
- **THEN** both mounts remain attached to the same runtime identity
- **AND** each mount keeps its own ordered grant rule set and workspace metadata

#### Scenario: Ordered grant rules are evaluated last-match-wins

- **GIVEN** a workspace mount applies `/src` as `ro` and later applies `/src/generated` as `rw`
- **WHEN** workspace bash writes under `/src/generated`
- **THEN** the later `rw` rule wins and the write succeeds
- **AND** writes under `/src/manual` still fail because the broader `ro` rule remains in effect there

#### Scenario: Path grants enforce read-only and writable boundaries

- **GIVEN** a workspace mount grants `/src` as read-only and `/tmp` as writable
- **WHEN** workspace bash execution attempts to write under `/src`
- **THEN** the execution is rejected as a permission violation
- **AND** writes under `/tmp` remain allowed

### Requirement: WorkspaceSystem SHALL expose public and avatar-private asset roots

Each mounted workspace SHALL expose one shared public asset root and one avatar-private asset root. Public assets SHALL be shared across avatars using that workspace, while avatar-private assets SHALL remain isolated by Avatar identity.

#### Scenario: Workspace public assets are shared across avatars

- **WHEN** one avatar writes a memory, skill, tool, or archive artifact into the workspace public root
- **THEN** another avatar mounting the same workspace can read that artifact through WorkspaceSystem
- **AND** the artifact is not copied into each avatar-private root

#### Scenario: Avatar-private workspace assets stay isolated

- **WHEN** one avatar writes a memory, skill, tool, or archive artifact into its workspace avatar-private root
- **THEN** a different avatar mounting the same workspace does not see that artifact in its own private root
- **AND** the artifact remains addressable through the owning avatar's private workspace slot only

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution

WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by the fixed avatar root workspace plus any currently granted dynamic workspaces. Root workspace bash and workspace bash SHALL both enforce path authority through a shared overlay-rule filesystem implementation. Dynamic workspace grants SHALL be evaluated as workspace-root-relative ordered glob patterns with default-deny and last-match-wins semantics. The shell SHALL use real absolute path semantics for mounted roots while still restricting access to mounted authorities only. `root_bash` SHALL execute against one session-owned durable `just-bash` world whose filesystem, mount graph, and command registry persist across calls. Each `root_bash` execution SHALL still start with isolated shell session state, and the implementation MUST NOT retain a legacy per-call root-workspace `Bash` construction path alongside the durable world.

#### Scenario: Root workspace bash uses real mounted paths

- **WHEN** the AI runs `pwd` or `ls` in root workspace bash
- **THEN** the shell reports the real absolute mount paths, such as `~/.agenter/avatars/<principal>` or an explicitly mounted project root
- **AND** it does not expose synthetic prompt-facing mount aliases such as `/workspace`

#### Scenario: Unmounted paths remain inaccessible

- **WHEN** root workspace bash tries to access a filesystem path that is not the fixed avatar root workspace and is not under a currently granted workspace mount
- **THEN** the execution is rejected or the path is not found inside the shell sandbox
- **AND** the runtime does not silently widen filesystem authority

#### Scenario: Ungranted paths stay unreadable

- **GIVEN** a workspace mount grants `/src/**/*.ts` as read-only
- **WHEN** workspace bash or root workspace bash attempts to read `/docs/roadmap.md`
- **THEN** the read is rejected because no rule grants that path
- **AND** directory listings only expose paths that remain readable or traversable under the same rule set

#### Scenario: Updated rules apply to later shell executions without rebuilding the host authority model

- **GIVEN** one runtime already has a workspace mounted through the shared overlay-rule filesystem
- **WHEN** the operator updates that workspace's grant rules
- **THEN** a later shell execution sees the new readable and writable boundaries
- **AND** the runtime does not need a restart to apply the changed rules

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

### Requirement: WorkspaceSystem SHALL reserve persistent processes for terminal sessions

One-shot workspace bash execution SHALL reject background shell statements instead of pretending to host durable processes. Long-running services and other persistent processes SHALL be created and recovered through TerminalSystem.

#### Scenario: Root workspace bash rejects background service startup

- **WHEN** the AI runs `node server.js > server.log 2>&1 &` through `root_bash`
- **THEN** the execution exits non-zero before accepting that background statement as valid delivery flow
- **AND** stderr tells the caller to create or recover a terminal for long-running work

#### Scenario: Workspace bash rejects background service startup

- **WHEN** the AI runs `python3 -m http.server 4173 --bind 127.0.0.1 &` through workspace bash
- **THEN** the execution exits non-zero
- **AND** the caller is redirected toward the terminal workflow instead of relying on one-shot bash persistence

### Requirement: Runtime bootstrap SHALL not imply workspace mounts or root grants

Runtime boot and recovery SHALL restore only durably attached workspace resources. Starting a runtime MUST NOT imply new project workspace mounts, path grants, or additional authority beyond the fixed avatar root workspace.

#### Scenario: Cold boot does not synthesize project workspace authority

- **WHEN** a runtime starts without any previously attached project workspace facts
- **THEN** only the fixed avatar root workspace is mounted
- **AND** no project workspace path becomes available until explicit mount and grant records exist

#### Scenario: Session creation does not auto-mount bootstrap workspace

- **WHEN** a session is created against a workspace but no explicit runtime mount or grant record exists yet
- **THEN** the runtime does not auto-attach that project workspace just because the session started
- **AND** only the fixed avatar root workspace remains available until an explicit workspace mount happens

#### Scenario: Runtime restart restores only persisted workspace mounts

- **WHEN** a runtime restarts after previously attached workspaces were durably recorded
- **THEN** recovery restores only those persisted workspace mounts whose grant facts still exist
- **AND** it does not synthesize extra workspace authority during restart

### Requirement: WorkspaceSystem SHALL distinguish shell surface compatibility from env capability authority

WorkspaceSystem SHALL keep existing `root-workspace` and `public-workspace` shell surfaces as visible command-surface compatibility, while private CLI availability SHALL be determined by workspace instance env and capability projection. The fixed avatar-root mount is normally the runtime's default avatar-private workspace instance and MAY carry `AVATAR_HOME` / `SKILLS_HOME`; ordinary mounted project workspaces remain collaboration-oriented by default and SHALL NOT inherit private env or CLI merely because the runtime also owns an avatar-root mount. A mounted workspace MAY still receive private capability through explicit workspace instance env.

#### Scenario: Fixed avatar mount is the root-workspace surface

- **WHEN** a runtime starts
- **THEN** its fixed avatar-root mount is treated as `root-workspace`
- **AND** its private CLI availability is explained by that workspace instance's env projection rather than by the visible `root-workspace` label alone

#### Scenario: Mounted project workspace is a public-workspace surface

- **WHEN** a runtime mounts an ordinary project workspace
- **THEN** that mount is treated as a `public-workspace` shell surface
- **AND** the presence of workspace avatar-private subtrees does not upgrade it into `root-workspace`

#### Scenario: Public-workspace shell excludes private CLI without env projection

- **WHEN** the operator or AI executes a shell against a `public-workspace`
- **THEN** avatar-private CLI helpers are not auto-mounted into that shell unless its workspace instance env projects that capability
- **AND** the shell remains collaboration-safe by default

#### Scenario: Root-workspace owns one durable shell world

- **WHEN** the runtime serves repeated `root_bash` calls
- **THEN** those calls reuse the same root-workspace shell world for that runtime
- **AND** the durable root-workspace shell world does not change the collaboration semantics of other shell surfaces

#### Scenario: Non-root workspace with Avatar home can receive private CLI

- **GIVEN** a mounted project workspace instance has non-empty `AVATAR_HOME`
- **WHEN** systems evaluate workspace CLI projection
- **THEN** systems that require avatar-private capability may project their CLI into that workspace
- **AND** the workspace does not need to be renamed or reclassified as `root-workspace`

#### Scenario: Public-workspace shell keeps collaboration-oriented environment semantics

- **WHEN** the operator or AI executes a shell against a `public-workspace`
- **THEN** the runtime does not silently rewrite `HOME` to the avatar root workspace
- **AND** caller-provided environment semantics stay distinct from `root-workspace` defaults

#### Scenario: Shared terminal follows public-workspace semantics instead of root-workspace semantics

- **WHEN** a shared terminal is created or recovered for collaborative work
- **THEN** it follows the same collaboration-oriented env/CLI law as `public-workspace`
- **AND** the existence of a durable root-workspace shell world does not upgrade that terminal into `root-workspace`

### Requirement: WorkspaceSystem SHALL expose browser CLI execution as explicit shell-surface routing

WorkspaceSystem SHALL expose one structured command discovery surface for both the fixed root-workspace shell and mounted public-workspace shells. Browser execution from the workspace helpcenter SHALL route through the existing backend shell truth instead of reconstructing a second browser-local shell. The browser-facing exec contract SHALL allow explicit `root-workspace` vs `public-workspace` selection.

#### Scenario: Browser routes one root-shell command through active runtime truth

- **WHEN** the browser executes a workspace CLI row with `preferredExecutionSurface = "root-workspace"`
- **THEN** the platform routes that call through the active runtime's durable root shell world
- **AND** the browser does not reconstruct a second local shell implementation

#### Scenario: Browser public-workspace exec keeps collaboration shell semantics

- **WHEN** the browser executes a workspace CLI row with `preferredExecutionSurface = "public-workspace"`
- **THEN** the platform routes that call through the public-workspace one-shot shell
- **AND** the shell keeps public-workspace grant and env semantics

#### Scenario: Root-shell browser exec does not auto-start stopped runtime authority

- **WHEN** the browser requests `root-workspace` execution for a runtime that is not currently active
- **THEN** the request fails with an explicit runtime-not-active error
- **AND** the platform does not auto-start the runtime merely to satisfy that browser exec call
