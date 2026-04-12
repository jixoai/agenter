# runtime-skill-progressive-disclosure Specification

## Purpose
Define how runtime built-in skills stay concise, overview-first, and progressively expandable through real filesystem paths.

## Requirements

### Requirement: Runtime built-in skills SHALL use concise overview-first `SKILL.md` documents
Each runtime built-in skill SHALL keep its `SKILL.md` concise and action-oriented, focusing on what the skill does, when to use it, the minimal checklist, and where to expand for more detail.

#### Scenario: Terminal skill stays overview-first
- **WHEN** the runtime exposes the built-in `agenter-terminal` skill
- **THEN** its `SKILL.md` states the terminal lifecycle boundary and quick-start usage
- **AND** it does not inline a long delivery or network-verification playbook in the overview body

### Requirement: Runtime built-in skills SHALL expose sibling references for deeper material
Each built-in skill MAY expose deeper guidance through sibling `references/*.md` files, and `SKILL.md` SHALL list those references explicitly when they exist.

#### Scenario: Message skill points to room protocol references
- **WHEN** the runtime exposes the built-in `agenter-message` skill
- **THEN** `SKILL.md` lists one or more sibling `references/*.md` files for deeper room protocol or workflow detail
- **AND** those reference files remain under the same skill directory as the owning `SKILL.md`

### Requirement: Global runtime prompts SHALL teach real-path skill expansion
The global runtime prompts SHALL teach AI to expand skill detail progressively by using `skills.list`, then `ccski info <skill>`, then reading only the needed sibling reference files from the real filesystem path returned by `ccski info`.

#### Scenario: AI learns to expand one reference file on demand
- **WHEN** the runtime prompt explains how to use skills
- **THEN** it states that `ccski info <skill>` returns the real `SKILL.md` path
- **AND** it instructs the model to inspect only the needed `references/*.md` files via shell from that path when more detail is required

### Requirement: Atomic built-in skills SHALL avoid cross-system delivery workaround detail in their overview body
Atomic built-in skills SHALL keep their overview body within their own system boundary instead of repeating cross-system delivery, host-binding, room-settlement, or verifier workaround detail.

#### Scenario: Message and terminal overviews stop repeating exact-host delivery rules
- **WHEN** the runtime renders the overview body for `agenter-message` or `agenter-terminal`
- **THEN** the overview content stays focused on durable room communication or terminal lifecycle respectively
- **AND** it does not inline exact-host URL verification or final room-delivery sequencing as part of that atomic skill overview
