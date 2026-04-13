## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution
WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by the fixed avatar root workspace plus any currently granted dynamic workspaces. Root workspace bash and workspace bash SHALL both enforce path authority through a shared overlay-rule filesystem implementation. Dynamic workspace grants SHALL be evaluated as workspace-root-relative ordered glob patterns with default-deny and last-match-wins semantics. The shell SHALL preserve each surface's visible mount-path style while still restricting access to mounted authorities only. Each execution SHALL start with isolated shell session state while preserving filesystem side effects across executions.

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
- **THEN** `root_workspace_bash` can still verify that URL with one-shot network commands such as `curl`
- **AND** AI does not need to abandon the shell verification step just because the service is local

#### Scenario: Filesystem effects persist while shell session state does not
- **WHEN** the first workspace bash execution creates a file and exports an environment variable
- **THEN** a later execution can read the created file
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
