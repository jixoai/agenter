## MODIFIED Requirements

### Requirement: Runtime terminal descriptors SHALL expose transition-aware config commands

Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose `terminal get-config` and `terminal set-config` for durable terminal launch/config truth.

#### Scenario: Terminal get-config is descriptor-backed

- **WHEN** the AI runs `terminal get-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the command returns durable terminal config truth instead of forcing callers to inspect unrelated files or internal DB state

#### Scenario: Terminal set-config is descriptor-backed

- **WHEN** the AI runs `terminal set-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second hand-written parser or mutation surface for the same payload

### Requirement: Runtime terminal help SHALL teach create auto-bootstrap plus transition wait law

Terminal CLI help SHALL describe the current terminal lifecycle contract precisely.

#### Scenario: Help teaches create auto-bootstrap

- **WHEN** the AI runs `terminal create --help`
- **THEN** the help text explains that public create auto-bootstraps by default
- **AND** callers understand that a brand new terminal does not normally require a second explicit bootstrap command

#### Scenario: Help teaches transition wait behavior

- **WHEN** the AI runs `terminal bootstrap --help`, `terminal stop --help`, or `terminal set-config --help`
- **THEN** the help text explains that `lifecycleTransition = bootstrapping | killing` means a lifecycle mutation is already in flight
- **AND** callers are told to reread terminal status instead of stacking another conflicting lifecycle mutation
