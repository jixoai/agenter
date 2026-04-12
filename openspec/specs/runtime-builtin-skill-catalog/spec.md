# runtime-builtin-skill-catalog Specification

## Purpose
Define package-owned runtime skill sources, generated runtime catalogs, and override precedence for built-in skills.

## Requirements

### Requirement: Runtime built-in skills SHALL be authored in package-owned skill source directories
The system SHALL store each runtime built-in skill in the owning package under `skills/**/SKILL.md`, instead of centralizing the full skill body in `app-server` runtime code.

#### Scenario: Terminal skill is owned by terminal-system
- **WHEN** the runtime exposes the built-in `agenter-terminal` skill
- **THEN** its source of truth lives under `packages/terminal-system/skills/**/SKILL.md`
- **AND** `app-server` does not hand-write a second full copy of that skill body in runtime code

### Requirement: Build tooling SHALL aggregate package-owned skill sources into one runtime catalog
The system SHALL aggregate package-owned skill sources into a generated runtime catalog that app-server can load directly at runtime.

#### Scenario: Generated catalog includes package-owned skill metadata and body templates
- **WHEN** the runtime skill catalog builder scans package skill sources
- **THEN** it produces one generated catalog entry per built-in skill
- **AND** each entry contains the skill name, summary, source path, owning package metadata, and body template needed for runtime rendering

### Requirement: Runtime SHALL render built-in skills from the generated catalog without writing them into root workspace storage
The runtime SHALL expose built-in skills through `ccski list/info/search` from the generated catalog, and SHALL not materialize those built-ins into `<rootWorkspace>/skills`.

#### Scenario: Built-in skills are discoverable without root workspace writes
- **WHEN** a runtime boots and the model calls `ccski list`
- **THEN** the built-in runtime skills appear in the discoverability output
- **AND** the runtime does not need to create `SKILL.md` files under `<rootWorkspace>/skills` for those built-ins

### Requirement: Runtime built-in skill rendering SHALL support bounded runtime slot expansion
The runtime SHALL expand only bounded runtime slots inside built-in skill templates, including runtime identity facts and descriptor-backed command examples.

#### Scenario: Built-in runtime skill expands principal and command examples at read time
- **WHEN** the runtime renders the built-in `agenter-runtime` skill for `ccski info`
- **THEN** the output includes the current principal id and root workspace path
- **AND** descriptor-backed example sections are expanded from the current runtime tool descriptors instead of hard-coded duplicate example strings

### Requirement: On-disk skills SHALL override built-in catalog entries with the same name
The runtime SHALL treat built-in catalog entries as the lowest-precedence baseline, so shared/global/avatar on-disk skills can override a built-in skill with the same name.

#### Scenario: Avatar-authored skill overrides a built-in entry
- **WHEN** an on-disk runtime skill under shared, global, or avatar roots uses the same skill name as a built-in catalog entry
- **THEN** `ccski list` and `ccski info` resolve to the on-disk skill entry
- **AND** the built-in entry remains available only as the baseline before that override is applied
