# ghostty-native-platform-distribution Specification

## Purpose
Define the release and runtime law for distributing `@jixo/ghostty-native` as an umbrella package plus explicit platform-native package atoms.

## Requirements

### Requirement: Ghostty-native SHALL publish platform-native packages under the Jixo namespace

`@jixo/ghostty-native` SHALL remain the umbrella JavaScript API, but supported hosts MUST resolve the native backend artifact from installed platform packages under the `@jixo/ghostty-native-*` namespace instead of treating a local source build as the default production path.

The release/distribution contract SHALL make the supported target-triple set explicit. Phase 1 SHALL cover the user-approved host set `darwin`, `windows`, `linux-arm64`, and `linux-amd64`. Development source checkouts MAY keep a local build helper, but supported release installs MUST prefer packaged native artifacts.

#### Scenario: Supported host resolves prebuilt native artifact
- **GIVEN** a supported host with the matching `@jixo/ghostty-native-*` platform package installed
- **WHEN** `@termless/core` requests the `ghostty-native` backend
- **THEN** the umbrella package resolves the installed platform artifact
- **AND** it does not invoke a local Zig or shell build as the normal runtime path

#### Scenario: Unsupported host fails clearly
- **GIVEN** a host outside the supported platform package matrix
- **WHEN** the runtime requests `ghostty-native`
- **THEN** the backend loader fails with a clear unsupported-platform error
- **AND** it does not silently pretend the backend is available

#### Scenario: Phase-1 host matrix is explicit
- **GIVEN** the phase-1 ghostty distribution contract is inspected
- **WHEN** the supported host set is listed
- **THEN** it explicitly includes `darwin`, `windows`, `linux-arm64`, and `linux-amd64`
- **AND** the first supported matrix is not left implicit in release metadata or runtime logic

### Requirement: Ghostty platform distribution SHALL be explicit in release metadata and runtime resolution

Release bundle specs, publish order, and runtime resolution code SHALL explicitly model the umbrella package and its platform packages. Runtime resolution MUST NOT depend on scanning repo-local `build/` directories or source-only artifact paths in production installs.

#### Scenario: Publish path enumerates the platform package atoms
- **GIVEN** the release pipeline prepares publishable packages for ghostty-native
- **WHEN** package specs and publish order are inspected
- **THEN** they enumerate the umbrella package and the supported platform packages explicitly
- **AND** the release path does not rely on an implicit post-install source build

#### Scenario: Development fallback stays development-only
- **GIVEN** a local source checkout without packaged platform artifacts
- **WHEN** a maintainer intentionally uses the ghostty build helper during development
- **THEN** the local build path can still produce the native artifact for that checkout
- **AND** production runtime resolution logic still prefers installed platform packages over repo-local build directories

#### Scenario: Host-only smoke validates the current machine without pretending full-matrix release coverage
- **GIVEN** a maintainer wants to smoke-test release bundle preparation on the current host before CI has staged every foreign ghostty artifact
- **WHEN** the explicit host-only smoke path runs
- **THEN** it stages and bundles only the current host's ghostty platform package alongside the shared JavaScript bundle atoms
- **AND** it does not claim that foreign platform packages were validated or bundled
