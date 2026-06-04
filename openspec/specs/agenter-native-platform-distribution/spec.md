# agenter-native-platform-distribution Specification

## Purpose
Define the durable public install law for `agenter` as a wrapper package over explicit host-native CLI binaries, and keep the supported target matrix single-sourced across npm, runtime resolution, and downstream projections.
## Requirements
### Requirement: Agenter public package SHALL remain a wrapper shell over native platform binaries

The public `agenter` npm package SHALL keep ownership of the `agenter` command name, but it SHALL no longer be the runtime implementation authority. Its durable role SHALL be:

- expose the fixed public command path for `agenter`
- resolve the current host to one explicit `@jixoai/cli-*` platform package
- place or execute the matching compiled Bun binary without requiring the operator to manage Bun manually
- preserve `@agenter/cli` as the private launcher/bootstrap source authority rather than reimplementing launcher law in the wrapper

The public wrapper MAY use Node during install or fallback execution, but normal runtime invocation of `agenter` MUST execute the compiled native binary for the current host directly.

#### Scenario: npm install resolves to a host-native runtime path

- **GIVEN** an operator installs `agenter` on a supported host with npm
- **WHEN** the install completes and the operator runs `agenter --version`
- **THEN** the observable command path resolves to the compiled host-native Agenter binary
- **AND** the operator does not need to separately install or invoke Bun
- **AND** the runtime launcher behavior still projects the `@agenter/cli` authority

#### Scenario: Script-disabled install still has an explicit fallback path

- **GIVEN** an operator installs `agenter` with install scripts disabled or optional dependency download failure
- **WHEN** the normal postinstall placement path cannot complete
- **THEN** the package still exposes a documented fallback wrapper path
- **AND** that fallback path resolves the same host-native platform package rather than executing a hidden JS bundle as if it were native

### Requirement: Native CLI platform matrix SHALL be explicit and single-sourced

The system SHALL define one durable platform matrix for Agenter native CLI distribution. That matrix SHALL be single-sourced and SHALL drive:

- GitHub release archive generation
- public npm platform package names and metadata
- runtime host-resolution logic
- Homebrew formula download mapping

Phase-1 support SHALL include:

- `darwin-x64`
- `darwin-arm64`
- `win32-x64`
- `win32-arm64`
- `linux-x64-gnu`
- `linux-arm64-gnu`
- `linux-x64-musl`
- `linux-arm64-musl`

#### Scenario: Matrix truth stays aligned across projections

- **GIVEN** a maintainer inspects release metadata, npm platform packages, and Homebrew generation inputs
- **WHEN** they compare the supported target list
- **THEN** the same explicit platform matrix appears in every projection
- **AND** no projection invents an extra target or omits a supported target silently

### Requirement: Platform packages SHALL be thin binary atoms

Each public `@jixoai/cli-*` platform package SHALL be a thin distribution atom for exactly one host target. A platform package SHALL include only:

- the compiled Agenter executable for that target
- minimal host metadata such as `os`, `cpu`, and `libc` where applicable
- minimal accompanying metadata files such as `README` and package manifest

Platform packages SHALL NOT become source authorities, bundle every target into one install surface, or add second copies of launcher logic that belongs to `@agenter/cli`.

#### Scenario: Platform package stays narrow

- **GIVEN** a maintainer inspects one published `@jixoai/cli-*` package
- **WHEN** they list its packaged files and manifest
- **THEN** it contains only one target’s compiled binary plus minimal metadata
- **AND** it does not contain unrelated foreign-target binaries
- **AND** it does not embed an alternate launcher implementation
