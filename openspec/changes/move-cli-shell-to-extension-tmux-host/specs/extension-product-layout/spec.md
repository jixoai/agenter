## ADDED Requirements

### Requirement: Product workspace resolution SHALL support extension roots

The product command launcher SHALL treat `extensions/*` as a first-class local workspace product root. Local product lookup SHALL search descriptor-controlled package names in extension roots without importing product implementation code or adding product-specific path branches.

#### Scenario: Shell command resolves cli-shell from extensions

- **GIVEN** `extensions/cli-shell/package.json` exists with name `agenter-ext-shell`
- **WHEN** the launcher resolves product command `shell`
- **THEN** it resolves the local workspace target from `extensions/cli-shell`
- **AND** it does not require `packages/cli-shell` to exist
- **AND** the core launcher still does not import cli-shell implementation code

#### Scenario: Non-shell extension products remain supported

- **GIVEN** a product package lives under `extensions/studio`
- **WHEN** the launcher resolves product command `studio`
- **THEN** it may resolve that package from `extensions/studio`
- **AND** extension-root support stays descriptor-driven instead of hardcoding cli-shell-specific paths
