## ADDED Requirements

### Requirement: App workspace resolution SHALL support extension roots

The app command launcher SHALL treat `apps/*` as a first-class local workspace app root. Local app lookup SHALL search descriptor-controlled package names in extension roots without importing app implementation code or adding app-specific path branches.

#### Scenario: Shell command resolves cli-shell from extensions

- **GIVEN** `apps/cli-shell/package.json` exists with name `agenter-app-shell`
- **WHEN** the launcher resolves app command `shell`
- **THEN** it resolves the local workspace target from `apps/cli-shell`
- **AND** it does not require `packages/cli-shell` to exist
- **AND** the core launcher still does not import cli-shell implementation code

#### Scenario: Non-shell extension products remain supported

- **GIVEN** a app package lives under `apps/studio`
- **WHEN** the launcher resolves app command `studio`
- **THEN** it may resolve that package from `apps/studio`
- **AND** extension-root support stays descriptor-driven instead of hardcoding cli-shell-specific paths
