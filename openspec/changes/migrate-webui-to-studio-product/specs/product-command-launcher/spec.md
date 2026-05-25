## ADDED Requirements

### Requirement: Studio command SHALL launch through product descriptors

The core `agenter` CLI SHALL resolve product command `studio` to package `agenter-ext-studio` through descriptor data and launch it through the same product command launcher law used by other first-party products.

#### Scenario: Studio command resolves to Studio package

- **WHEN** a user runs `agenter studio`
- **THEN** the core CLI resolves product command `studio` to package `agenter-ext-studio`
- **AND** it launches the package bin with remaining arguments preserved
- **AND** Studio-specific flags remain product argv

#### Scenario: Studio package resolution stays local-first

- **GIVEN** `packages/studio/package.json` exists with name `agenter-ext-studio`
- **WHEN** a user runs `agenter studio` from the Agenter workspace
- **THEN** the launcher uses the local workspace package before installed or remote fallback sources

#### Scenario: Studio receives launcher-owned runtime context

- **WHEN** the launcher starts `agenter-ext-studio`
- **THEN** the product process receives `AGENTER_DAEMON_HOST`, `AGENTER_DAEMON_PORT`, `AGENTER_PRODUCT_COMMAND=studio`, and `AGENTER_PRODUCT_PACKAGE=agenter-ext-studio`
- **AND** Studio does not need to rediscover the daemon independently

### Requirement: Web command SHALL be removed from core CLI

The core `agenter` CLI SHALL NOT retain `web` as a built-in command, product alias, or compatibility shim after the Studio migration. `agenter web` SHALL fail through the unsupported-command path.

#### Scenario: Web command is unsupported after migration

- **WHEN** a user runs `agenter web`
- **THEN** the launcher rejects `web` as an unsupported command
- **AND** it does not route to `agenter-ext-studio`
- **AND** it does not start a daemon, static server, or dev server

#### Scenario: Core no longer owns Studio static assets

- **WHEN** reviewers inspect the core CLI package
- **THEN** the CLI package does not contain WebUI static-root resolution or asset-copy code for the active operator product
- **AND** Studio serving belongs to `agenter-ext-studio`
