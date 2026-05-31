## ADDED Requirements

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
