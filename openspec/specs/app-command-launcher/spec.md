# app-command-launcher Specification

## Purpose
Define how the core `agenter` CLI launches first-party app command packages through descriptors while preserving daemon bootstrap law and app isolation.

## Requirements

### Requirement: Agenter CLI SHALL launch first-party app command packages through descriptors

The core `agenter` CLI SHALL resolve controlled app commands to first-party npm package names through app descriptors and launch the package bin while preserving the core daemon/auth-service bootstrap law. The launcher SHALL stay app-agnostic after descriptor lookup; app grammar and app UX belong to the launched package.

#### Scenario: Shell command resolves to Shell package
- **WHEN** a user runs `agenter shell`
- **THEN** the core CLI resolves app command `shell` to package `agenter-app-shell`
- **AND** it launches bin `agenter-shell`
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** parsing optional `@avatar` grammar and the default `shell-assistant` policy remains the responsibility of `agenter-app-shell`

#### Scenario: Studio command resolves to Studio package
- **WHEN** a user runs `agenter studio`
- **THEN** the core CLI resolves app command `studio` to package `agenter-app-studio`
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** Studio-specific flags remain app argv

#### Scenario: Shell command preserves explicit Avatar argv
- **WHEN** a user runs `agenter shell @default`
- **THEN** the core CLI resolves app command `shell` to package `agenter-app-shell`
- **AND** it forwards `@default` as app argv
- **AND** it does not parse or reinterpret that Avatar mention in core runtime modules

#### Scenario: Unsupported app commands are rejected
- **WHEN** a user runs `agenter unknown-app`
- **THEN** the core CLI rejects the command with a clear unsupported-app error
- **AND** it does not attempt to execute an arbitrary npm package name

#### Scenario: Shell2 command is unsupported after Shell promotion
- **WHEN** a user runs `agenter shell2`
- **THEN** the core CLI rejects `shell2` as an unsupported app command
- **AND** it does not route to the Shell package
- **AND** it does not start a daemon for the removed incubation command

#### Scenario: App registry owns package metadata
- **WHEN** the launcher handles app command `shell`
- **THEN** it resolves command metadata from a controlled registry entry
- **AND** that entry contains package name `agenter-app-shell`
- **AND** that entry contains bin `agenter-shell` and main export `runShell`
- **AND** the registry entry is descriptor data, not an import of Shell implementation code
- **AND** user-provided command text cannot alter the package name or bin path

#### Scenario: Web command is unsupported after Studio migration
- **WHEN** a user runs `agenter web`
- **THEN** the launcher rejects `web` as an unsupported command
- **AND** it does not route to `agenter-app-studio`
- **AND** it does not start a daemon, static server, or dev server

#### Scenario: App command handling does not pollute core runtime
- **WHEN** reviewers inspect core CLI and runtime modules after adding `shell`
- **THEN** Shell-specific parsing, TUI state, toolbar state, resource naming, dialogue layout, and managed/takeover policy are absent from core runtime modules
- **AND** Studio-specific static-root resolution, asset-copy code, Vite serving flags, and browser storage keys are absent from core runtime modules
- **AND** the core launcher only handles descriptor lookup, daemon/auth context, package resolution, stdio, and process exit propagation

### Requirement: App package resolution SHALL be local-first

The app command launcher SHALL resolve app packages from the current monorepo workspace before falling back to installed packages or remote npm execution.

#### Scenario: Local workspace package wins during development
- **GIVEN** `apps/shell/package.json` exists with name `agenter-app-shell`
- **WHEN** a user runs `agenter shell` from the Agenter workspace
- **THEN** the launcher uses the local workspace package bin
- **AND** it does not require the package to be published to npm

#### Scenario: Studio local workspace package wins during development
- **GIVEN** `apps/studio/package.json` exists with name `agenter-app-studio`
- **WHEN** a user runs `agenter studio` from the Agenter workspace
- **THEN** the launcher uses the local workspace package before installed or remote fallback sources

#### Scenario: Remote npm fallback runs without install prompt
- **GIVEN** no local or installed `agenter-app-shell` package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher automatically invokes the configured package runner for `agenter-app-shell`
- **AND** it does not stop to ask the user to install the package manually

#### Scenario: Installed package bin is read from package metadata
- **GIVEN** an installed `agenter-app-shell` package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher resolves the bin from that package's `package.json`
- **AND** it does not guess an executable path from user input

### Requirement: Remote package fallback SHALL be explicit and testable

The app command launcher SHALL use a controlled package-runner abstraction for remote npm fallback. In the current Bun-based CLI, the default remote runner MAY be `bunx`, but the runner command SHALL be configurable for tests and future runtimes.

#### Scenario: Default Bun runner constructs remote command
- **GIVEN** no local or installed `agenter-app-shell` package is resolvable
- **AND** no package runner override is configured
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher constructs a remote runner command for package `agenter-app-shell`
- **AND** it forwards the original app argv after the package/bin boundary

#### Scenario: Package runner override is honored
- **GIVEN** a package runner override is configured for tests or a non-Bun runtime
- **WHEN** remote fallback is required
- **THEN** the launcher uses the configured package runner
- **AND** the controlled package name remains `agenter-app-shell`

### Requirement: App launcher SHALL pass daemon connection context to apps

The app command launcher SHALL ensure or reuse a local daemon and pass connection context to the launched app through explicit environment variables. App packages MAY expose matching CLI flags for direct test entry, but the launcher-owned env contract is canonical.

#### Scenario: App receives daemon host and port
- **WHEN** the launcher starts `agenter-app-shell`
- **THEN** the app process receives `AGENTER_DAEMON_HOST` and `AGENTER_DAEMON_PORT`
- **AND** the app does not need to rediscover a second daemon independently

#### Scenario: Studio receives launcher-owned runtime context
- **WHEN** the launcher starts `agenter-app-studio`
- **THEN** the app process receives `AGENTER_DAEMON_HOST`, `AGENTER_DAEMON_PORT`, `AGENTER_APP_COMMAND=studio`, and `AGENTER_APP_PACKAGE=agenter-app-studio`
- **AND** Studio does not need to rediscover the daemon independently

#### Scenario: App does not create a second daemon discovery authority
- **WHEN** the launcher starts `agenter-app-shell`
- **THEN** Shell consumes the launcher-owned daemon context
- **AND** it does not independently write or treat a app-local `~/.agenter` port file as canonical daemon truth

#### Scenario: App receives auth-service bridge context
- **WHEN** the launcher starts `agenter-app-shell` against a daemon that uses an external auth-service endpoint
- **THEN** the app process receives `AGENTER_AUTH_SERVICE_ENDPOINT`
- **AND** the app does not start a competing auth-service bridge

#### Scenario: App receives source metadata
- **WHEN** the launcher starts `agenter-app-shell`
- **THEN** the app process receives `AGENTER_APP_COMMAND=shell`
- **AND** it receives `AGENTER_APP_PACKAGE=agenter-app-shell`
- **AND** it receives `AGENTER_APP_SOURCE` as `workspace`, `installed`, or `remote`

#### Scenario: App foreground exit does not stop the managed daemon
- **WHEN** the launcher ensures a managed daemon authority for a app command
- **AND** the foreground app process exits
- **THEN** the launcher does not stop the daemon
- **AND** daemon-owned resources remain under daemon lifecycle control
- **AND** explicit `agenter daemon stop` or `agenter daemon restart` owns daemon shutdown

#### Scenario: Launcher reuses healthy daemon authority for the same runtime root
- **GIVEN** one healthy local daemon already owns the same runtime home root but is listening on a different loopback port than the launcher's default request
- **WHEN** a user runs `agenter shell --session=7 --avatar=bangeel` through the default launcher path
- **THEN** the launcher discovers that same-root daemon authority before starting another local daemon
- **AND** it forwards the discovered daemon host and port to `agenter-app-shell`
- **AND** it does not start a competing second daemon writer for that runtime root

#### Scenario: Stale daemon descriptor is ignored during auto-start
- **GIVEN** the runtime home root contains a stale daemon descriptor whose endpoint is no longer healthy
- **WHEN** a app command needs launcher-owned daemon bootstrap
- **THEN** the launcher ignores that stale descriptor
- **AND** it may start a new local daemon for that runtime root

### Requirement: App launcher SHALL preserve terminal process semantics

The app command launcher SHALL run app bins as foreground interactive processes with inherited stdio and exit status propagation.

#### Scenario: App TUI owns the foreground terminal
- **WHEN** `agenter-app-shell` starts an interactive TUI
- **THEN** the app receives the current terminal stdin/stdout/stderr
- **AND** keyboard interaction is handled by the app process

#### Scenario: App exit code is propagated
- **WHEN** the app process exits with a non-zero code
- **THEN** the core `agenter` process exits with the same code
- **AND** the failure remains visible to shell automation
