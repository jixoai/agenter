## ADDED Requirements

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
