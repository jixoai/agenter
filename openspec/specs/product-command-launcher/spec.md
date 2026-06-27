# product-command-launcher Specification

## Purpose

Define the app command launcher law for first-party Agenter products so product commands resolve through descriptors rather than core CLI branches.
## Requirements
### Requirement: Studio command SHALL launch through app descriptors

The core `agenter` CLI SHALL resolve app command `studio` to package `agenter-app-studio` through descriptor data and launch it through the same app command launcher law used by other first-party products.

#### Scenario: Studio command resolves to Studio package

- **WHEN** a user runs `agenter studio`
- **THEN** the core CLI resolves app command `studio` to package `agenter-app-studio`
- **AND** it launches the package bin with remaining arguments preserved
- **AND** Studio-specific flags remain app argv

#### Scenario: Studio package resolution stays local-first

- **GIVEN** `apps/studio/package.json` exists with name `agenter-app-studio`
- **WHEN** a user runs `agenter studio` from the Agenter workspace
- **THEN** the launcher uses the local workspace package before installed or remote fallback sources

#### Scenario: Studio receives launcher-owned runtime context

- **WHEN** the launcher starts `agenter-app-studio`
- **THEN** the app process receives `AGENTER_DAEMON_HOST`, `AGENTER_DAEMON_PORT`, `AGENTER_APP_COMMAND=studio`, and `AGENTER_APP_PACKAGE=agenter-app-studio`
- **AND** Studio does not need to rediscover the daemon independently

### Requirement: Web command SHALL be removed from core CLI

The core `agenter` CLI SHALL NOT retain `web` as a built-in command, app alias, or compatibility shim after the Studio migration. `agenter web` SHALL fail through the unsupported-command path.

#### Scenario: Web command is unsupported after migration

- **WHEN** a user runs `agenter web`
- **THEN** the launcher rejects `web` as an unsupported command
- **AND** it does not route to `agenter-app-studio`
- **AND** it does not start a daemon, static server, or dev server

#### Scenario: Core no longer owns Studio static assets

- **WHEN** reviewers inspect the core CLI package
- **THEN** the CLI package does not contain WebUI static-root resolution or asset-copy code for the active operator app
- **AND** Studio serving belongs to `agenter-app-studio`

### Requirement: App launcher SHALL keep shell2 as a daemon-backed incubation command

The app command launcher SHALL continue routing `shell2` to `agenter-app-shell-next` as a local incubation command until user acceptance. Once shell-next app attach is implemented, the `shell2` descriptor SHALL advertise daemon-backed runtime requirements without changing the stable `shell` descriptor.

#### Scenario: Shell2 descriptor remains separate from shell

- **WHEN** reviewers inspect app command descriptors during shell-next incubation
- **THEN** `shell2` resolves to `agenter-app-shell-next`
- **AND** `shell` still resolves to `agenter-app-shell`

#### Scenario: Shell2 descriptor advertises daemon-backed runtime after attach implementation

- **WHEN** shell-next default attach uses daemon/client-sdk app bootstrap
- **THEN** the `shell2` descriptor marks daemon use as required
- **AND** it advertises launch, resources, assistant, and attention runtime planes

### Requirement: App launcher SHALL expose shell2 as a local shell-next incubation command

The app command launcher SHALL expose `shell2` as a local-only incubation command for shell-next. `shell2` SHALL resolve to the workspace package `agenter-app-shell-next` and preserve the same daemon/auth context passing law as other app commands. `shell2` SHALL NOT replace, alias, or modify the stable `shell` descriptor during incubation.

#### Scenario: Shell2 command resolves to shell-next package
- **WHEN** a developer runs `bun agenter shell2`
- **THEN** the core CLI resolves app command `shell2` to workspace package `agenter-app-shell-next`
- **AND** it launches the package bin with remaining arguments preserved
- **AND** it passes launcher-owned daemon and auth-service context through the existing app environment contract

#### Scenario: Shell command remains stable
- **WHEN** a user runs `bun agenter shell`
- **THEN** the core CLI resolves app command `shell` to package `agenter-app-shell`
- **AND** it does not route to `agenter-app-shell-next`
- **AND** it does not require shell-next to exist

#### Scenario: Shell2 is not remote fallback
- **GIVEN** no local workspace package `agenter-app-shell-next` is available
- **WHEN** a user runs `bun agenter shell2`
- **THEN** the launcher fails with a clear local-incubation package error
- **AND** it does not invoke a remote package runner for `agenter-app-shell-next`
- **AND** it does not ask the user to install shell-next from npm

#### Scenario: Shell2 metadata is descriptor data
- **WHEN** reviewers inspect the core app registry
- **THEN** `shell2` appears as descriptor metadata only
- **AND** the core launcher does not import shell-next implementation modules
- **AND** shell-next-specific argv grammar remains inside `agenter-app-shell-next`
