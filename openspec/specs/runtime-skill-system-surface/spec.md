# runtime-skill-system-surface Specification

## Purpose
Define the runtime skill system as the durable owner of runtime-visible skill truth, live watcher topology, and attention-backed skill change publication.

## Requirements

### Requirement: Runtime skill truth SHALL come from visible on-disk skill files
The runtime skill system SHALL treat shared, global, avatar, and indexed built-in skill source files as the durable truth for runtime-visible skills. Generated built-in catalogs remain the discovery baseline, but existing built-in source paths stay live on disk.

#### Scenario: Runtime-visible skill truth is rebuilt from disk
- **WHEN** the runtime skill system refreshes its catalog
- **THEN** it re-reads visible on-disk skill files for shared, global, avatar, and indexed built-in skills
- **AND** it rebuilds the canonical skill snapshot from those file-backed truths instead of from prompt glue

### Requirement: Skill live sync SHALL watch only declared skill files
The runtime skill system SHALL treat `SKILL.md` and sibling `ccski.config.json` as the default live-watch truth for each visible skill, and SHALL extend that scope only through declared `files[]` entries inside the config.

#### Scenario: Unrelated directory churn does not become skill truth
- **GIVEN** a visible skill directory contains `SKILL.md`, `ccski.config.json`, and an unrelated sqlite database file
- **WHEN** only the sqlite file changes and it is not declared in `files[]`
- **THEN** the runtime skill system does not emit a skill-change reminder
- **AND** the canonical skill snapshot remains unchanged

#### Scenario: Declared files participate in live refresh
- **GIVEN** a visible skill config declares `files=["references/*.md"]`
- **WHEN** one matching reference file changes
- **THEN** the runtime skill system treats that file as part of the skill truth
- **AND** the next refresh publishes the corresponding skill-change reminder

### Requirement: Watcher events SHALL flush at the next collection boundary
Watcher events SHALL be treated as dirtiness hints only. The runtime SHALL recompute skill truth from disk and publish aggregated reminders per changed skill at the next model input collection boundary, with an idle debounce fallback if no other input arrives first.

#### Scenario: One skill emits one aggregated reminder per flush
- **GIVEN** a skill edits `SKILL.md` and multiple declared files before the next model round starts
- **WHEN** the runtime reaches the next model input collection boundary
- **THEN** it emits one aggregated reminder for that skill
- **AND** the reminder lists the changed files instead of emitting one reminder per raw watcher event

#### Scenario: Idle runtimes still publish reminders after debounce
- **GIVEN** the runtime is idle and no other input arrives after a watched skill file changes
- **WHEN** the watcher debounce expires
- **THEN** the runtime refreshes the skill snapshot from disk
- **AND** it wakes the loop so the aggregated skill reminder becomes visible
