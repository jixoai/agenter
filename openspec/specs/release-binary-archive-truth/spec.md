# release-binary-archive-truth Specification

## Purpose
Define GitHub release archives and their manifest as the canonical publish-time binary truth for Agenter, with npm and Homebrew derived from that same archive set instead of rebuilding their own binaries.
## Requirements
### Requirement: GitHub release archives SHALL be the canonical Agenter binary truth

The system SHALL treat GitHub release binary archives as the canonical publish-time truth for Agenter native binaries. For every supported platform target, CI/CD SHALL produce one explicit release archive that contains the compiled Agenter executable for that host.

Every downstream projection, including npm wrapper packages and Homebrew formulae, SHALL derive from those release archives rather than building or downloading a second independently-produced binary artifact.

#### Scenario: Projections consume the same binary truth

- **GIVEN** a release has been published for a supported target
- **WHEN** a maintainer compares the GitHub release asset, the matching npm platform package, and the Homebrew formula payload
- **THEN** they all resolve to the same canonical compiled binary artifact for that target
- **AND** none of those projections silently rebuilds a different executable

### Requirement: Release archive manifest SHALL make binary truth inspectable

The system SHALL publish or derive a durable release-archive manifest that maps each supported target to:

- target identifier
- archive filename
- archive checksum
- canonical download URL
- projected npm platform package name
- projected Homebrew selector metadata

This manifest SHALL be the durable bridge between binary production and downstream install surfaces.

#### Scenario: Archive truth is machine-readable

- **GIVEN** a maintainer or automation step needs the Agenter binary for one host target
- **WHEN** it reads the release-archive manifest
- **THEN** it can resolve the exact archive name, checksum, and download URL for that target
- **AND** it does not have to infer those values from handwritten duplicated tables

### Requirement: Release workflow SHALL publish binary truth before projections

The release workflow SHALL publish GitHub release archives before it publishes or updates projections that depend on them. npm wrapper/package publish steps and Homebrew projection steps MUST fail closed when the required canonical archive for a supported target is missing.

#### Scenario: Projection step refuses missing canonical archive

- **GIVEN** a workflow tries to publish npm or Homebrew projections for a target
- **WHEN** the canonical GitHub release archive for that target does not exist or lacks checksum truth
- **THEN** the projection step fails before publish
- **AND** the system does not publish an install surface that points at an absent or unverifiable binary
