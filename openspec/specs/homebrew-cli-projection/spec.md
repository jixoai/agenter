# homebrew-cli-projection Specification

## Purpose
Define Homebrew as an install-facing projection of main-repo release truth so `brew tap jixoai/agenter` and `brew install agenter` stay aligned with the canonical host-native archive matrix.
## Requirements
### Requirement: Homebrew tap SHALL be a projection of main-repo release truth

The system SHALL support `brew tap jixoai/agenter` and `brew install agenter` through a dedicated tap repository projection. The durable source truth for Agenter formula content SHALL remain in the main repository; the tap repository SHALL be an install-facing projection target rather than an independently-authored source of platform logic.

#### Scenario: Tap repo does not become a second truth source

- **GIVEN** a maintainer inspects the Homebrew formula and the main repository release metadata
- **WHEN** the formula changes for a new release or platform matrix update
- **THEN** the formula change can be traced back to main-repo-generated truth
- **AND** the tap repo does not introduce a second handwritten platform matrix or launcher law

### Requirement: Homebrew formula SHALL install canonical release archives

The Agenter Homebrew formula SHALL install Agenter from the canonical GitHub release archive for the current host target and SHALL verify the archive checksum before install. The formula SHALL install the host-native compiled executable and SHALL NOT bootstrap Bun in order to run the published CLI.

#### Scenario: Brew install reaches the native binary directly

- **GIVEN** an operator runs `brew install agenter` on a supported host
- **WHEN** Homebrew downloads and installs the formula payload
- **THEN** the payload resolves to the canonical GitHub release archive for that host target
- **AND** Homebrew verifies the declared checksum
- **AND** the installed `agenter` command executes the compiled native binary directly

### Requirement: Homebrew projection SHALL remain aligned with the supported target matrix

The formula generation path SHALL derive host selection and archive metadata from the same supported target matrix used by GitHub release archive generation and npm platform packaging. Homebrew projection MUST NOT silently drift from the canonical target list.

#### Scenario: Formula mapping stays aligned

- **GIVEN** the supported Agenter native target matrix includes Darwin, Windows, Linux glibc, and Linux musl variants where applicable
- **WHEN** the Homebrew projection is regenerated
- **THEN** the formula generation input is derived from the same matrix truth
- **AND** unsupported or omitted targets are explicit rather than implied
