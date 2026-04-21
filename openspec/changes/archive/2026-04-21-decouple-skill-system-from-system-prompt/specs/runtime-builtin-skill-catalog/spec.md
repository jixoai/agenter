## MODIFIED Requirements

### Requirement: Runtime SHALL render built-in skills from the generated catalog without writing them into root workspace storage
The runtime SHALL expose built-in skills through the dedicated `skill list/info/search` surface from the generated catalog, and SHALL not materialize those built-ins into `<rootWorkspace>/skills`.

#### Scenario: Built-in skills are discoverable without root workspace writes
- **WHEN** a runtime boots and the model calls `skill list`
- **THEN** the built-in runtime skills appear in the discoverability output
- **AND** the runtime does not need to create `SKILL.md` files under `<rootWorkspace>/skills` for those built-ins

### Requirement: Runtime built-in skill rendering SHALL support bounded runtime slot expansion
The runtime SHALL expand only bounded runtime slots inside built-in skill templates, including runtime identity facts and descriptor-backed command examples.

#### Scenario: Built-in runtime skill expands principal and command examples at read time
- **WHEN** the runtime renders the built-in `agenter-runtime` skill for `skill info`
- **THEN** the output includes the current principal id and root workspace path
- **AND** descriptor-backed example sections are expanded from the current runtime tool descriptors instead of hard-coded duplicate example strings

### Requirement: Existing built-in skill source paths SHALL stay live as runtime truth
For built-in skills already indexed by the generated catalog, the runtime SHALL prefer the current on-disk `SKILL.md` and sibling config file at that source path when those files exist, so edits to existing built-in skill sources can refresh without a prompt-bound compatibility path.

#### Scenario: Existing built-in skill source edits are visible without workspace materialization
- **WHEN** a package-owned built-in skill source file changes on disk
- **THEN** `skill info` and the canonical skill snapshot refresh from that on-disk source path
- **AND** the runtime still does not materialize that built-in skill into `<rootWorkspace>/skills`

### Requirement: On-disk skills SHALL override built-in catalog entries with the same name
The runtime SHALL treat built-in catalog entries as the lowest-precedence baseline, so shared/global/avatar on-disk skills can override a built-in skill with the same name.

#### Scenario: Avatar-authored skill overrides a built-in entry
- **WHEN** an on-disk runtime skill under shared, global, or avatar roots uses the same skill name as a built-in catalog entry
- **THEN** `skill list` and `skill info` resolve to the on-disk skill entry
- **AND** the built-in entry remains available only as the baseline before that override is applied
