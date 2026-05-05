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
The runtime SHALL expose built-in skills through `skill list/info/search` from the generated catalog, and SHALL not materialize those built-ins into `<rootWorkspace>/skills`.

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
For built-in skills already indexed by the generated catalog, the runtime SHALL prefer the current on-disk `SKILL.md` and sibling config file at that source path when those files exist, so edits to existing built-in skill sources can refresh without reintroducing prompt-bound glue.

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

### Requirement: Built-in skill guidance SHALL stay soft and action/query oriented

Built-in runtime skills MAY teach etiquette, defaults, follow-up patterns, and preferred playbooks as non-binding guidance, but they SHALL not reintroduce removed platform obligation labels, hidden auto-acknowledgement rules, or other runtime-authored semantic conclusions.

#### Scenario: Message skill teaches explicit room actions instead of obligation labels

- **WHEN** the generated built-in message skill is rendered
- **THEN** it teaches `message send`, `message edit`, `message recall`, `message read`, and `message query` as the relevant room actions/query surfaces
- **AND** it does not rely on platform labels such as `room_reply_pending`, `self_update`, `chatTurnState`, or `settlesWhen`

#### Scenario: Message skill teaches room projections as queries

- **WHEN** the generated built-in message skill explains participants, presence, or visible rooms
- **THEN** it presents them as explicit room/message query surfaces
- **AND** it does not imply that eager prompt metadata has already decided those facts for the model

#### Scenario: Terminal skill teaches await-first strategy without lifecycle obligation

- **WHEN** the generated built-in terminal skill is rendered
- **THEN** it may recommend `terminal await`, bounded reads, or verification-first workflows as soft guidance
- **AND** it does not describe `terminal_focus`, `terminal_unfocus`, or `terminal_idle_ready` as AI-visible task obligations

### Requirement: Runtime skill catalog generation SHALL guard against removed pollution terms

Catalog generation and regression tests SHALL fail when removed platform-pollution terms or hidden auto-acknowledgement guidance reappear in generated built-in runtime skill bodies.

#### Scenario: Removed terms fail catalog tests

- **WHEN** tests inspect the generated runtime skill catalog
- **THEN** they fail if removed social-obligation terms or auto-ACK instructions appear in message guidance

#### Scenario: Source edits regenerate clean catalog

- **WHEN** a package-owned built-in skill source is edited
- **THEN** generated catalog output matches the edited source
- **AND** the pollution-term guard still passes
