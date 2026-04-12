## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution
WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by the fixed avatar root workspace plus any currently granted dynamic workspaces. The shell SHALL use real absolute path semantics for mounted roots while still restricting access to mounted authorities only.

#### Scenario: Root workspace bash uses real mounted paths
- **WHEN** the AI runs `pwd` or `ls` in root workspace bash
- **THEN** the shell reports the real absolute mount paths, such as `~/.agenter/avatars/<principal>` or an explicitly mounted project root
- **AND** it does not expose synthetic prompt-facing mount aliases such as `/workspace`

#### Scenario: Unmounted paths remain inaccessible
- **WHEN** root workspace bash tries to access a filesystem path that is not the fixed avatar root workspace and is not under a currently granted workspace mount
- **THEN** the execution is rejected or the path is not found inside the shell sandbox
- **AND** the runtime does not silently widen filesystem authority

#### Scenario: One-shot bash can verify loopback URLs like a terminal
- **WHEN** the runtime starts a local HTTP service on `127.0.0.1` through a granted terminal
- **THEN** `root_workspace_bash` can still verify that URL with one-shot network commands such as `curl`
- **AND** AI does not need to abandon the shell verification step just because the service is local

#### Scenario: Transport failure stays a command failure
- **GIVEN** no process is listening on a loopback port
- **WHEN** root workspace bash runs `curl -s -o /dev/null -w "%{http_code}"` against that URL
- **THEN** the command exits non-zero
- **AND** stdout does not fabricate a successful-looking HTTP result such as `502`
- **AND** the command result preserves an AI-detectable failure signal, with `exitCode` as the minimum truth source even when curl is asked to stay silent
