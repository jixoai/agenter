## MODIFIED Requirements

### Requirement: Runtime skill truth SHALL come from visible on-disk skill files

The runtime skill system SHALL expose a single facade while keeping catalog discovery, truth snapshot construction, diffing, baseline persistence, watcher dirtiness, and attention publication as separate internal atoms. Runtime-visible skill identity SHALL continue to be keyed only by `skill.name`.

#### Scenario: Runtime-visible skill truth is rebuilt from disk

- **WHEN** the runtime skill system refreshes its catalog
- **THEN** it re-reads visible on-disk skill files for shared, global, avatar, and indexed built-in skills
- **AND** it rebuilds the canonical skill snapshot from those file-backed truths instead of from prompt glue
- **AND** the diff and override identity remains the visible `skill.name`

#### Scenario: Internal atoms remain orthogonal behind the facade

- **WHEN** a refresh publishes skill snapshot and skill-change ingress
- **THEN** catalog discovery, truth snapshot construction, diffing, baseline persistence, watcher dirtiness, and ingress publication remain separately testable responsibilities
- **AND** callers continue to use the existing runtime skill facade instead of coupling to those internals
