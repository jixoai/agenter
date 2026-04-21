## ADDED Requirements

### Requirement: Skill system SHALL treat on-disk skill files as durable truth
The runtime skill system SHALL treat shared, global, and avatar on-disk skill roots as the writable durable truth for runtime-visible skills. Built-in catalog entries SHALL remain the read-only baseline.

#### Scenario: Writable skill roots are scanned as canonical file truth
- **WHEN** the runtime skill system refreshes its catalog
- **THEN** it reads shared, global, and avatar skill roots as writable file-backed entries
- **AND** it merges built-in catalog entries as the lowest-precedence read-only baseline

#### Scenario: Built-in skill cannot be removed through the writable surface
- **WHEN** a caller asks the runtime to remove a built-in skill entry
- **THEN** the request is rejected
- **AND** the built-in skill remains available as a read-only catalog entry

### Requirement: Runtime SHALL expose a dedicated skill CLI and local API surface
The runtime SHALL expose a dedicated `skill` namespace for runtime-local skill discovery and mutation instead of reusing `ccski` as the public command contract.

#### Scenario: Root workspace shell exposes skill as a first-class command
- **WHEN** the AI runs `which skill` inside `root_workspace_bash`
- **THEN** the command is discoverable and executable from that shell session
- **AND** the public runtime contract no longer depends on `ccski` as the primary skill command

#### Scenario: Skill surface supports discovery and mutation
- **WHEN** the AI or operator calls the runtime-local `skill` surface
- **THEN** it supports `list`, `search`, `info`, `upsert`, `remove`, and `refresh`
- **AND** each command obeys the same runtime credential and workspace boundary rules as other runtime-local CLI surfaces

### Requirement: Skill mutations SHALL refresh the attention-backed skill snapshot and emit reminders
Whenever the writable skill surface changes runtime-visible skills, the runtime SHALL refresh the canonical skill snapshot context and emit an attention reminder describing the change.

#### Scenario: Upsert refreshes the skill snapshot and creates an attention reminder
- **WHEN** `skill upsert` creates or modifies a writable skill
- **THEN** the runtime refreshes the canonical skill snapshot context
- **AND** it emits an attention item describing that the skill was added or modified

#### Scenario: Remove refreshes the skill snapshot and creates an attention reminder
- **WHEN** `skill remove` deletes a writable skill
- **THEN** the runtime refreshes the canonical skill snapshot context
- **AND** it emits an attention item describing that the skill was removed

### Requirement: Runtime SHALL watch only declared skill files for live skill refresh
The runtime skill system SHALL treat `SKILL.md` and sibling `ccski.config.json` as the default live-watch truth for each visible skill, and SHALL extend that watch scope only through declared `files[]` entries inside the config.

#### Scenario: Unrelated database churn inside a skill directory does not trigger a skill change
- **GIVEN** a visible skill directory contains `SKILL.md`, `ccski.config.json`, and an unrelated sqlite database file
- **WHEN** only the sqlite file changes and it is not declared in `files[]`
- **THEN** the runtime skill system does not emit a skill-change reminder
- **AND** the canonical skill snapshot remains unchanged

#### Scenario: Declared extra files participate in live skill refresh
- **GIVEN** a visible skill config declares `files=["references/*.md"]`
- **WHEN** one matching reference file changes
- **THEN** the runtime skill system treats that file as part of the skill truth
- **AND** the next refresh publishes the corresponding skill-change reminder

### Requirement: Runtime SHALL aggregate watcher dirtiness into collection-boundary refreshes
Watcher events SHALL be treated as dirtiness hints only. The runtime SHALL recompute skill truth from disk and publish aggregated reminders per changed skill at the next model input collection boundary, with an idle debounce fallback if no other input arrives first.

#### Scenario: Multiple file edits for one skill collapse into one reminder
- **GIVEN** a skill edits `SKILL.md` and two declared reference files before the next model round starts
- **WHEN** the runtime reaches the next model input collection boundary
- **THEN** it emits one aggregated reminder for that skill
- **AND** the reminder lists the changed files instead of emitting one reminder per file event

#### Scenario: Idle runtimes still publish skill changes after debounce
- **GIVEN** the runtime is idle and no other input arrives after a watched skill file changes
- **WHEN** the watcher debounce window expires
- **THEN** the runtime refreshes the skill snapshot from disk
- **AND** it wakes the loop so the aggregated skill reminder becomes visible
