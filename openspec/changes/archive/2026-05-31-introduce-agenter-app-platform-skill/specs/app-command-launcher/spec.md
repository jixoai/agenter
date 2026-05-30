## ADDED Requirements

### Requirement: App package resolution SHALL filter remote candidates by app-owned host peer dependency

The app command launcher SHALL treat an app package's `peerDependencies.agenter` range as the compatibility authority for remote or catalog-discovered app versions. Agenter SHALL NOT maintain a central host-owned lock table that binds `agenter@A.B.*` directly to one app package version line. Candidate discovery MAY come from workspace packages, installed packages, first-party descriptors, or a controlled catalog/index, but candidate compatibility SHALL be evaluated from the app package metadata back toward the current Agenter host version.

#### Scenario: Current host selects the highest compatible app version

- **GIVEN** app package `agenter-app-example` has versions `1.4.0`, `2.0.0`, and `2.1.0`
- **AND** only `2.0.0` and `2.1.0` declare `peerDependencies.agenter` compatible with the current Agenter host version
- **WHEN** the launcher resolves a remote fallback target for that app command
- **THEN** it selects the highest compatible candidate version
- **AND** it does not use a hardcoded host-owned version lock table

#### Scenario: Old hosts can keep resolving old app lines

- **GIVEN** `agenter@0.0.x` is the current host
- **AND** `agenter-app-example@1.x` declares compatibility with `agenter@0.0.x`
- **AND** `agenter-app-example@2.x` declares compatibility with `agenter@1.0.x`
- **WHEN** the old host resolves the app
- **THEN** it ignores the incompatible `2.x` line
- **AND** it can still select the compatible `1.x` line

#### Scenario: Package catalog discovers candidates but does not own compatibility truth

- **GIVEN** a catalog entry lists package `agenter-app-example` for command `example`
- **WHEN** Agenter resolves that app for the current host
- **THEN** the catalog only supplies the candidate package identity
- **AND** the package's `peerDependencies.agenter` remains the compatibility authority

#### Scenario: Global npm reverse scans are not required

- **WHEN** Agenter resolves app candidates
- **THEN** it uses first-party descriptors, workspace apps, installed apps, or a controlled catalog/index
- **AND** it does not require scanning the entire npm registry for packages with matching peer dependencies

### Requirement: App command descriptors SHALL be package-owned data

An Agenter app package SHALL expose command launch metadata as data: app id, command, package name, bin name, optional main export, source policy, and capability hints. The core launcher SHALL consume that data without importing app implementation modules or branching on app-specific UI, grammar, layout, hosting, serving, or local state.

#### Scenario: First-party app descriptor stays data

- **WHEN** the core launcher handles app command `shell`
- **THEN** it resolves a descriptor containing app id `shell`, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import Shell implementation code
- **AND** Shell-specific grammar such as optional Avatar, session naming, or TUI layout remains in the Shell app package

#### Scenario: Community app descriptor stays data

- **GIVEN** a community app package exposes a valid Agenter app descriptor
- **WHEN** Agenter resolves that app command
- **THEN** core consumes the descriptor data
- **AND** core does not import the community app implementation module before launching the resolved package target

## MODIFIED Requirements

### Requirement: Agenter CLI SHALL launch app command packages through descriptors

The core `agenter` CLI SHALL resolve controlled app commands to app package names through descriptors and launch the package bin while preserving the core daemon/auth-service bootstrap law. The launcher SHALL stay app-agnostic after descriptor lookup; app grammar and app UX belong to the launched package.

#### Scenario: Shell command resolves to Shell app package

- **WHEN** a user runs `agenter shell`
- **THEN** the core CLI resolves app command `shell` to the official Shell app package
- **AND** it launches bin `agenter-shell`
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** parsing optional Avatar grammar and the default `shell-assistant` policy remains the responsibility of the Shell app package

#### Scenario: Studio command resolves to Studio app package

- **WHEN** a user runs `agenter studio`
- **THEN** the core CLI resolves app command `studio` to the official Studio app package
- **AND** it launches the package bin with the remaining arguments preserved
- **AND** Studio-specific flags remain app argv

#### Scenario: Shell command preserves explicit Avatar argv

- **WHEN** a user runs `agenter shell @default`
- **THEN** the core CLI resolves app command `shell` to the official Shell app package
- **AND** it forwards `@default` as app argv
- **AND** it does not parse or reinterpret that Avatar mention in core runtime modules

#### Scenario: Unsupported app commands are rejected

- **WHEN** a user runs `agenter unknown-app`
- **THEN** the core CLI rejects the command with a clear unsupported-app error
- **AND** it does not attempt to execute an arbitrary npm package name

#### Scenario: Shell2 command is unsupported after Shell promotion

- **WHEN** a user runs `agenter shell2`
- **THEN** the core CLI rejects `shell2` as an unsupported app command
- **AND** it does not route to the Shell app package
- **AND** it does not start a daemon for the removed incubation command

#### Scenario: App registry owns package metadata

- **WHEN** the launcher handles app command `shell`
- **THEN** it resolves command metadata from a controlled registry or package-owned descriptor entry
- **AND** that entry contains the Shell app package name
- **AND** that entry contains bin `agenter-shell` and main export `runShell`
- **AND** the registry entry is descriptor data, not an import of Shell implementation code
- **AND** user-provided command text cannot alter the package name or bin path

#### Scenario: Web command is unsupported after Studio migration

- **WHEN** a user runs `agenter web`
- **THEN** the launcher rejects `web` as an unsupported command
- **AND** it does not route to the Studio app package
- **AND** it does not start a daemon, static server, or dev server

#### Scenario: App command handling does not pollute core runtime

- **WHEN** reviewers inspect core CLI and runtime modules after adding `shell`
- **THEN** Shell-specific parsing, TUI state, toolbar state, resource naming, dialogue layout, and managed/takeover policy are absent from core runtime modules
- **AND** Studio-specific static-root resolution, asset-copy code, Vite serving flags, and browser storage keys are absent from core runtime modules
- **AND** the core launcher only handles descriptor lookup, daemon/auth context, package resolution, stdio, and process exit propagation

### Requirement: App package resolution SHALL be local-first

The app command launcher SHALL resolve app packages from the current monorepo workspace before falling back to installed packages or remote npm execution. Local Agenter app packages SHALL live under `apps/*`; legacy `extensions/*` roots SHALL NOT be the active first-party app source after this change.

#### Scenario: Local workspace Shell app wins during development

- **GIVEN** `apps/shell/package.json` exists with the official Shell app package name
- **WHEN** a user runs `agenter shell` from the Agenter workspace
- **THEN** the launcher uses the local workspace app package bin
- **AND** it does not require the package to be published to npm

#### Scenario: Studio local workspace app wins during development

- **GIVEN** `apps/studio/package.json` exists with the official Studio app package name
- **WHEN** a user runs `agenter studio` from the Agenter workspace
- **THEN** the launcher uses the local workspace app before installed or remote fallback sources

#### Scenario: Remote npm fallback runs without install prompt

- **GIVEN** no local or installed Shell app package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher automatically invokes the configured package runner for the resolved Shell app package
- **AND** it does not stop to ask the user to install the package manually

#### Scenario: Installed package bin is read from package metadata

- **GIVEN** an installed Shell app package is resolvable
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher resolves the bin from that package's `package.json`
- **AND** it does not guess an executable path from user input

### Requirement: Remote package fallback SHALL be explicit and testable

The app command launcher SHALL use a controlled package-runner abstraction for remote npm fallback. In the current Bun-based CLI, the default remote runner MAY be `bunx`, but the runner command SHALL be configurable for tests and future runtimes. Remote fallback SHALL run the compatibility-selected app package version when the resolver has selected an explicit version.

#### Scenario: Default Bun runner constructs remote command

- **GIVEN** no local or installed Shell app package is resolvable
- **AND** no package runner override is configured
- **WHEN** a user runs `agenter shell`
- **THEN** the launcher constructs a remote runner command for the resolved Shell app package
- **AND** it forwards the original app argv after the package/bin boundary

#### Scenario: Package runner override is honored

- **GIVEN** a package runner override is configured for tests or a non-Bun runtime
- **WHEN** remote fallback is required
- **THEN** the launcher uses the configured package runner
- **AND** the controlled package name remains the resolved app package name

#### Scenario: Explicit compatible version is passed to remote runner

- **GIVEN** the app resolver selects `agenter-app-shell@2.0.3` for the current host
- **WHEN** remote fallback builds the runner command
- **THEN** the runner package argument includes the selected package version
- **AND** the launched bin and app argv remain unchanged

## REMOVED Requirements

### Requirement: Extension root is the active first-party app source

**Reason**: The user has explicitly upgraded the platform vocabulary from extension to app and requested local `extensions` be renamed to `apps`.
**Migration**: Active first-party app packages move to `apps/*`; references to `extensions/*` remain only in archived history or explicitly documented legacy compatibility notes.

## RENAMED Requirements

FROM: `Agenter CLI SHALL launch first-party app command packages through descriptors`
TO: `Agenter CLI SHALL launch app command packages through descriptors`

FROM: `App package resolution SHALL be local-first`
TO: `App package resolution SHALL be local-first`
