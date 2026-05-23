# runtime-skill-system-surface Specification

## Purpose

Define the runtime skill system as the durable owner of runtime-visible skill truth, live watcher topology, and attention-backed skill change publication.

## Requirements

### Requirement: Runtime skill truth SHALL come from visible on-disk skill files

The runtime skill system SHALL treat shared, global, avatar, and indexed built-in skill source files as the durable truth for runtime-visible skills. Generated built-in catalogs remain the discovery baseline, but existing built-in source paths stay live on disk. The runtime-facing facade SHALL keep catalog discovery, truth snapshot construction, diffing, baseline persistence, watcher dirtiness, and attention publication as separate internal atoms, while visible skill identity remains keyed only by `skill.name`.

#### Scenario: Runtime-visible skill truth is rebuilt from disk

- **WHEN** the runtime skill system refreshes its catalog
- **THEN** it re-reads visible on-disk skill files for shared, global, avatar, and indexed built-in skills
- **AND** it rebuilds the canonical skill snapshot from those file-backed truths instead of from prompt glue
- **AND** diff and override identity remain the visible `skill.name`

#### Scenario: Internal atoms remain orthogonal behind the facade

- **WHEN** a refresh publishes skill snapshot and skill-change ingress
- **THEN** catalog discovery, truth snapshot construction, diffing, baseline persistence, watcher dirtiness, and ingress publication remain separately testable responsibilities
- **AND** callers continue to use the existing runtime skill facade instead of coupling to those internals

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

### Requirement: Skill refresh SHALL not create a dedicated task context by default

Skill refresh SHALL maintain a capability index and MAY publish ordinary objective attention items, but it SHALL NOT synthesize or auto-bootstrap a dedicated skill-only attention context solely because the skill index changed.

#### Scenario: Refresh updates the index without `ctx-skill-system`

- **WHEN** visible skill truth is refreshed during boot, collection, or watcher flush
- **THEN** `skill list`, `skill search`, `skill info`, and `skill get-config` reflect the latest capability index
- **AND** the runtime does not auto-create or auto-bootstrap a dedicated skill-only task context for that refresh

#### Scenario: Stopped-session restart refreshes only projection truth

- **WHEN** a watched skill changed while the runtime was stopped and the same session later restarts
- **THEN** the runtime refreshes the skill projection/index and any ordinary reminder facts
- **AND** it does not replay that change as a permanent dedicated skill peer

#### Scenario: Changed skill publishes one ordinary objective item

- **WHEN** a visible skill file changes and notification policy allows publication
- **THEN** the runtime emits one ordinary objective attention item describing the changed skill name, root kind, and changed files
- **AND** it does not synthesize a dedicated skill-system context solely because the files changed

### Requirement: Runtime skill outline SHALL apply only when the generated outline changes

The runtime skill attention context SHALL represent the current skills outline. The outline SHALL be generated from skill name and description, not from implementation details such as watched reference content or filesystem paths. Runtime skill refresh SHALL publish context-applying outline ingress only when that generated outline changes.

#### Scenario: Description change updates skill context

- **GIVEN** the runtime skill context contains the current skill outline
- **WHEN** a skill is added, removed, renamed, or its description changes
- **THEN** runtime skill snapshot ingress applies the new generated outline to the skill context

#### Scenario: Internal skill detail change does not rewrite outline

- **GIVEN** the runtime skill context contains the current skill outline
- **WHEN** only watched internal skill files or references change without changing skill names or descriptions
- **THEN** runtime may emit skill-change attention items
- **AND** runtime does not publish a context-applying skill outline ingress
- **AND** the skill `attentionContext` content remains unchanged

### Requirement: Watcher events SHALL flush at the next collection boundary

Watcher events SHALL be treated as dirtiness hints only. The runtime SHALL recompute skill truth from disk and publish aggregated reminders per changed skill at the next model input collection boundary, with an idle debounce fallback if no other input arrives first. When the runtime process was absent and no watcher could observe the edit, refresh SHALL compare current skill truth with the session-local fingerprint manifest.

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

#### Scenario: Missing fingerprint manifest initializes a baseline

- **GIVEN** a runtime session has visible skills but no persisted skill fingerprint manifest
- **WHEN** the runtime skill system refreshes with reminder publication enabled
- **THEN** it writes the current skill fingerprints as the baseline
- **AND** it does not emit added reminders for every existing skill

#### Scenario: Stopped-runtime skill edit emits a reminder on restart

- **GIVEN** a runtime session has already written a skill fingerprint manifest
- **AND** one observed skill file changes while the runtime process is stopped
- **WHEN** the same session starts and refreshes runtime skills
- **THEN** the runtime emits one aggregated updated-skill reminder
- **AND** the manifest is advanced so a later restart without further edits emits no duplicate reminder

#### Scenario: Corrupt fingerprint manifest repairs without noisy reminders

- **GIVEN** a runtime session has an unreadable or incompatible skill fingerprint manifest
- **WHEN** the runtime skill system refreshes
- **THEN** it replaces the manifest with the current skill fingerprints
- **AND** it does not infer broad skill-change reminders from the corrupt baseline

### Requirement: Skill change notification SHALL be objective and explicitly scoped

Skill file changes MAY publish objective notifications when configured by runtime law, but those notifications SHALL describe index-level skill truth changes and SHALL NOT masquerade as task obligations unrelated to the current work.

#### Scenario: Changed skill notification stays objective

- **WHEN** a visible skill file changes and notification policy allows publication
- **THEN** the emitted fact describes the changed skill name, root kind, and changed files
- **AND** it does not instruct the model that it must abandon unrelated current work

#### Scenario: Irrelevant skill churn does not preempt task work

- **WHEN** a skill file changes while the model is working on an unrelated room or terminal task
- **THEN** scheduler policy may record the index change
- **AND** the current task is not replaced by a skill-system task context by default

### Requirement: Skill bootstrap SHALL be explicit or objective-dependency-driven

Runtime skill bootstrap content SHALL enter model work only when explicitly requested, explicitly mounted, or already objectively required by the active work. Hidden special supply paths SHALL NOT inject a dedicated skill context by default.

#### Scenario: Explicit skill query enters the decision surface

- **WHEN** the model calls `skill list`, `skill search`, `skill info`, or `skill get-config`
- **THEN** the returned skill projection enters the current decision surface as a tool/action result

#### Scenario: Explicit mount can bring skill content into work

- **WHEN** an operator, model action, or already-objective task dependency explicitly mounts a skill body or skill snapshot
- **THEN** that mounted content may enter the current decision surface
- **AND** the supply path remains inspectable as an explicit query, mount, or dependency

#### Scenario: Default bootstrap omits a permanent skill task

- **WHEN** a model call is prepared for ordinary room or terminal work
- **THEN** the runtime does not include a permanent or dedicated skill-system attention context unless the current work already reached it through an explicit standard supply path
