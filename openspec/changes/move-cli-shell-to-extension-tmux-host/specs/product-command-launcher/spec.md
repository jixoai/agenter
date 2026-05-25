## MODIFIED Requirements

### Requirement: Product package resolution SHALL be local-first across product workspace roots

The product command launcher SHALL resolve product packages from controlled local workspace roots before falling back to installed packages or remote npm execution. The local roots SHALL include `extensions/*` and `packages/*`, with extension products allowed to live outside core packages.

#### Scenario: Local extension cli-shell wins before installed fallback

- **GIVEN** `extensions/cli-shell/package.json` exists with name `agenter-ext-shell`
- **WHEN** the launcher resolves `agenter shell`
- **THEN** it launches the extension-local package bin
- **AND** it does not require `packages/cli-shell`

#### Scenario: Local package Studio still resolves

- **GIVEN** `packages/studio/package.json` exists with name `agenter-ext-studio`
- **WHEN** the launcher resolves `agenter studio`
- **THEN** it launches the package-local Studio bin
- **AND** extension support does not add Studio-specific core code
