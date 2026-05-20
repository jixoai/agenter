# product-command-launcher Specification

## Purpose
Define how the core `agenter` CLI launches first-party product command packages through descriptors while preserving daemon bootstrap law and product isolation.

## Requirements

### Requirement: Agenter CLI SHALL launch first-party product command packages through descriptors

The core `agenter` CLI SHALL resolve controlled product commands to first-party npm package names through product descriptors and launch the package bin while preserving the core daemon/auth-service bootstrap law. The launcher SHALL stay product-agnostic after descriptor lookup; product grammar and product UX belong to the launched package.

#### Scenario: Shell command resolves to cli-shell package
- **WHEN** a user runs `agenter shell`
- **THEN** the core CLI resolves product command `shell` to package `@agenter/cli-shell`
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** parsing optional `@avatar` grammar and the default `shell-assistant` policy remains the responsibility of `@agenter/cli-shell`

#### Scenario: Studio command resolves to Studio package
- **WHEN** a user runs `agenter studio`
- **THEN** the core CLI resolves product command `studio` to package `@agenter/studio`
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** Studio-specific flags remain product argv

#### Scenario: Shell command preserves explicit Avatar argv
- **WHEN** a user runs `agenter shell @default`
- **THEN** the core CLI resolves product command `shell` to package `@agenter/cli-shell`
- **AND** it forwards `@default` as product argv
- **AND** it does not parse or reinterpret that Avatar mention in core runtime modules

#### Scenario: Unsupported product commands are rejected
- **WHEN** a user runs `agenter unknown-product`
- **THEN** the core CLI rejects the command with a clear unsupported-product error
- **AND** it does not attempt to execute an arbitrary npm package name

#### Scenario: Product registry owns package metadata
- **WHEN** the launcher handles product command `shell`
- **THEN** it resolves command metadata from a controlled registry entry
- **AND** that entry contains package name `@agenter/cli-shell`
- **AND** the registry entry is descriptor data, not an import of cli-shell implementation code
- **AND** user-provided command text cannot alter the package name or bin path

#### Scenario: Web command is unsupported after Studio migration
- **WHEN** a user runs `agenter web`
- **THEN** the launcher rejects `web` as an unsupported command
- **AND** it does not route to `@agenter/studio`
- **AND** it does not start a daemon, static server, or dev server

#### Scenario: Product command handling does not pollute core runtime
- **WHEN** reviewers inspect core CLI and runtime modules after adding `shell`
- **THEN** cli-shell-specific parsing, TUI state, toolbar state, resource naming, dialogue layout, and managed/takeover policy are absent from core runtime modules
- **AND** Studio-specific static-root resolution, asset-copy code, Vite serving flags, and browser storage keys are absent from core runtime modules
- **AND** the core launcher only handles descriptor lookup, daemon/auth context, package resolution, stdio, and process exit propagation

### Requirement: Product package resolution SHALL be local-first

The product command launcher SHALL resolve product packages from the current monorepo workspace before falling back to installed packages or remote npm execution.

#### Scenario: Local workspace package wins during development
- **GIVEN** `packages/cli-shell/package.json` exists with name `@agenter/cli-shell`
- **WHEN** a user runs `agenter shell` from the Agenter workspace
- **THEN** the launcher uses the local workspace package bin
- **AND** it does not require the package to be published to npm

#### Scenario: Studio local workspace package wins during development
- **GIVEN** `packages/studio/package.json` exists with name `@agenter/studio`
- **WHEN** a user runs `agenter studio` from the Agenter workspace
- **THEN** the launcher uses the local workspace package before installed or remote fallback sources

#### Scenario: Remote npm fallback runs without install prompt
- **GIVEN** no local or installed `@agenter/cli-shell` package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher automatically invokes the configured package runner for `@agenter/cli-shell`
- **AND** it does not stop to ask the user to install the package manually

#### Scenario: Installed package bin is read from package metadata
- **GIVEN** an installed `@agenter/cli-shell` package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher resolves the bin from that package's `package.json`
- **AND** it does not guess an executable path from user input

### Requirement: Remote package fallback SHALL be explicit and testable

The product command launcher SHALL use a controlled package-runner abstraction for remote npm fallback. In the current Bun-based CLI, the default remote runner MAY be `bunx`, but the runner command SHALL be configurable for tests and future runtimes.

#### Scenario: Default Bun runner constructs remote command
- **GIVEN** no local or installed `@agenter/cli-shell` package is resolvable
- **AND** no package runner override is configured
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher constructs a remote runner command for package `@agenter/cli-shell`
- **AND** it forwards the original product argv after the package/bin boundary

#### Scenario: Package runner override is honored
- **GIVEN** a package runner override is configured for tests or a non-Bun runtime
- **WHEN** remote fallback is required
- **THEN** the launcher uses the configured package runner
- **AND** the controlled package name remains `@agenter/cli-shell`

### Requirement: Product launcher SHALL pass daemon connection context to products

The product command launcher SHALL ensure or reuse a local daemon and pass connection context to the launched product through explicit environment variables. Product packages MAY expose matching CLI flags for direct test entry, but the launcher-owned env contract is canonical.

#### Scenario: Product receives daemon host and port
- **WHEN** the launcher starts `@agenter/cli-shell`
- **THEN** the product process receives `AGENTER_DAEMON_HOST` and `AGENTER_DAEMON_PORT`
- **AND** the product does not need to rediscover a second daemon independently

#### Scenario: Studio receives launcher-owned runtime context
- **WHEN** the launcher starts `@agenter/studio`
- **THEN** the product process receives `AGENTER_DAEMON_HOST`, `AGENTER_DAEMON_PORT`, `AGENTER_PRODUCT_COMMAND=studio`, and `AGENTER_PRODUCT_PACKAGE=@agenter/studio`
- **AND** Studio does not need to rediscover the daemon independently

#### Scenario: Product does not create a second daemon discovery authority
- **WHEN** the launcher starts `@agenter/cli-shell`
- **THEN** cli-shell consumes the launcher-owned daemon context
- **AND** it does not independently write or treat a product-local `~/.agenter` port file as canonical daemon truth

#### Scenario: Product receives auth-service bridge context
- **WHEN** the launcher starts `@agenter/cli-shell` against a daemon that uses an external auth-service endpoint
- **THEN** the product process receives `AGENTER_AUTH_SERVICE_ENDPOINT`
- **AND** the product does not start a competing auth-service bridge

#### Scenario: Product receives source metadata
- **WHEN** the launcher starts `@agenter/cli-shell`
- **THEN** the product process receives `AGENTER_PRODUCT_COMMAND=shell`
- **AND** it receives `AGENTER_PRODUCT_PACKAGE=@agenter/cli-shell`
- **AND** it receives `AGENTER_PRODUCT_SOURCE` as `workspace`, `installed`, or `remote`

#### Scenario: Launcher cleans up daemon it owns
- **WHEN** the launcher starts a daemon only for the product command
- **THEN** it owns cleanup of that daemon after the product exits
- **AND** it does not stop a daemon that was already running before product launch

#### Scenario: Launcher reuses healthy daemon authority for the same runtime root
- **GIVEN** one healthy local daemon already owns the same runtime home root but is listening on a different loopback port than the launcher's default request
- **WHEN** a user runs `agenter shell --web` through the default launcher path
- **THEN** the launcher discovers that same-root daemon authority before starting another local daemon
- **AND** it forwards the discovered daemon host and port to `@agenter/cli-shell`
- **AND** it does not start a competing second daemon writer for that runtime root

#### Scenario: Stale daemon descriptor is ignored during auto-start
- **GIVEN** the runtime home root contains a stale daemon descriptor whose endpoint is no longer healthy
- **WHEN** a product command needs launcher-owned daemon bootstrap
- **THEN** the launcher ignores that stale descriptor
- **AND** it may start a new local daemon for that runtime root

### Requirement: Product launcher SHALL preserve terminal process semantics

The product command launcher SHALL run product bins as foreground interactive processes with inherited stdio and exit status propagation.

#### Scenario: Product TUI owns the foreground terminal
- **WHEN** `@agenter/cli-shell` starts an interactive TUI
- **THEN** the product receives the current terminal stdin/stdout/stderr
- **AND** keyboard interaction is handled by the product process

#### Scenario: Product exit code is propagated
- **WHEN** the product process exits with a non-zero code
- **THEN** the core `agenter` process exits with the same code
- **AND** the failure remains visible to shell automation
