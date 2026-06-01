## ADDED Requirements

### Requirement: Note skill SHALL be cataloged from the NoteSystem package

The runtime built-in skill catalog SHALL discover the `note` skill from `packages/note-system/skills/**/SKILL.md`. Generated metadata SHALL name `@agenter/note-system` as the owning package and SHALL NOT name `@agenter/app-server` as the owner for the NoteSystem skill after extraction.

#### Scenario: Generated catalog reflects NoteSystem package ownership

- **WHEN** the runtime skill catalog is rebuilt
- **THEN** the generated `note` entry has `sourcePath` under `packages/note-system/skills`
- **AND** `packageName` is `@agenter/note-system`
- **AND** the old `packages/app-server/skills/note/SKILL.md` source is absent

## MODIFIED Requirements

### Requirement: Runtime built-in skills SHALL be authored in package-owned skill source directories

The system SHALL store each runtime built-in skill in the owning package under `skills/**/SKILL.md`, instead of centralizing the full skill body in `app-server` runtime code.

#### Scenario: Terminal skill is owned by terminal-system

- **WHEN** the runtime exposes the built-in `agenter-terminal` skill
- **THEN** its source of truth lives under `packages/terminal-system/skills/**/SKILL.md`
- **AND** `app-server` does not hand-write a second full copy of that skill body in runtime code

#### Scenario: Note skill is owned by note-system

- **WHEN** the runtime exposes the built-in `note` skill
- **THEN** its source of truth lives under `packages/note-system/skills/**/SKILL.md`
- **AND** `app-server` does not hand-write a second full copy of that skill body in runtime code

## REMOVED Requirements

## RENAMED Requirements
