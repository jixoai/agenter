## MODIFIED Requirements

### Requirement: App package resolution SHALL be local-first across app workspace roots

The app command launcher SHALL resolve app packages from controlled local workspace roots before falling back to installed packages or remote npm execution. The local roots SHALL include `apps/*` and `packages/*`, with extension products allowed to live outside core packages.

#### Scenario: Local extension cli-shell wins before installed fallback

- **GIVEN** `apps/cli-shell/package.json` exists with name `agenter-app-shell`
- **WHEN** the launcher resolves `agenter shell`
- **THEN** it launches the extension-local package bin
- **AND** it does not require `packages/cli-shell`

#### Scenario: Local extension Studio still resolves

- **GIVEN** `apps/studio/package.json` exists with name `agenter-app-studio`
- **WHEN** the launcher resolves `agenter studio`
- **THEN** it launches the extension-local Studio bin
- **AND** extension support does not add Studio-specific core code
