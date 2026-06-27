## ADDED Requirements

### Requirement: Cli-shell replaceable host law SHALL admit shell-next

The cli-shell app architecture SHALL allow shell-next to replace tmux as the local host/compositor without changing TerminalSystem, MessageSystem, AvatarRuntime, AttentionSystem, or app binding truth. During incubation, the stable cli-shell implementation SHALL remain available until shell-next passes explicit user acceptance.

#### Scenario: Shell-next exercises replaceable host truth

- **WHEN** shell-next attaches to a app shell session
- **THEN** the bound TerminalSystem terminal id remains shell truth
- **AND** the bound MessageSystem room id remains room truth
- **AND** AvatarRuntime and attention contexts remain selected through app bootstrap
- **AND** tmux is not required as the shell-next presentation host

#### Scenario: Stable cli-shell remains available during incubation

- **WHEN** shell-next is still under `shell2`
- **THEN** the existing tmux-backed `cli-shell` remains the implementation behind `agenter shell`
