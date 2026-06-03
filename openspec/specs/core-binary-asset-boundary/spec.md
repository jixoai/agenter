# core-binary-asset-boundary Specification

## Purpose
Define how publishable core bundles explain non-JavaScript runtime assets and prevent optional app-owned assets from silently leaking into the core binary surface.

## Requirements

### Requirement: Core release bundles SHALL give every non-JavaScript asset an explicit owner and load reason

Every publishable core runtime bundle SHALL be able to explain each emitted non-JavaScript asset, including `.node`, `.wasm`, `.scm`, and equivalent runtime files. The minimum provenance record for each such asset SHALL include the owning package, the command or feature surface that requires it, and the runtime import or load path that causes it to ship.

Assets without explicit provenance SHALL NOT remain in the publishable bundle merely because the bundler followed a transitive import graph.

#### Scenario: Dist asset audit explains OpenTUI syntax files
- **GIVEN** a bundle output that includes `highlights-*.scm`, `injections-*.scm`, or `tree-sitter-*.wasm`
- **WHEN** release provenance is inspected
- **THEN** each file maps to a concrete owning package and runtime load path
- **AND** the audit can explain whether that asset is core-owned or app-owned

#### Scenario: Native asset audit explains surviving `.node` files
- **GIVEN** a bundle output that still includes native `.node` assets after phase-1 slimming
- **WHEN** release provenance is inspected
- **THEN** each native asset has a named package owner and install/runtime boundary
- **AND** no native asset remains as unexplained bundler residue

### Requirement: Core binary SHALL not silently inherit app-owned syntax assets

If syntax-highlighting or rich-rendering assets are required only by an optional app, shell, or TUI command surface, the release contract SHALL either move those assets behind the owning publishable package or declare them explicitly as app-owned assets in release metadata. The core `agenter` bundle MUST NOT keep such assets only because an optional command path pulled them into the transitive dependency graph.

#### Scenario: Retired TUI path no longer keeps OpenTUI syntax assets in the core bundle
- **GIVEN** the repo retires `@agenter/tui` as a live workspace package and core CLI surface
- **WHEN** release bundle ownership is reviewed
- **THEN** `bundle/agenter` no longer inherits OpenTUI syntax-highlighting `.scm/.wasm` assets from that retired edge
- **AND** any remaining legacy `tui-bak` directory is not treated as a live workspace or publishable package atom

#### Scenario: Legacy backup directory is not a live package edge
- **GIVEN** the retired TUI code is renamed to `tui-bak`
- **WHEN** workspace packages, publishable package manifests, or release bundle specs are inspected
- **THEN** `tui-bak` is absent from the live workspace/package graph
- **AND** the core binary does not keep a hidden dependency on the retired backup directory

#### Scenario: Provenance guard blocks accidental regressions
- **GIVEN** a contributor introduces a new transitive asset into `bundle/agenter`
- **WHEN** release boundary tests inspect the bundle manifest and provenance report
- **THEN** the tests fail unless the new asset has an explicit owner and load reason
- **AND** the failure occurs before publish
