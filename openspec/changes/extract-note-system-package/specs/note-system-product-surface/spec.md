## ADDED Requirements

### Requirement: NoteSystem SHALL be owned by an independent package

NoteSystem storage, SQLite identity/indexing, Markdown/reference normalization, search, typed surface helpers, CLI implementation, public types, package tests, package skill, and package spec SHALL live under `packages/note-system` as `@agenter/note-system`. App-server SHALL consume these APIs through the package export and SHALL NOT keep a parallel `packages/app-server/src/note-system` implementation tree.

#### Scenario: NoteSystem source is package-owned

- **WHEN** a maintainer inspects the NoteSystem implementation
- **THEN** the source of truth is under `packages/note-system/src`
- **AND** package-local behavior tests are under `packages/note-system/test`
- **AND** `packages/app-server/src/note-system` does not exist as an implementation directory

#### Scenario: App-server consumes NoteSystem as an atom

- **WHEN** app-server projects the `note` CLI, serves NoteSystem tRPC routes, or wires runtime APIs
- **THEN** it imports NoteSystem contracts from `@agenter/note-system`
- **AND** it only supplies host context such as `AVATAR_HOME`, current cwd, runtime env parsing, and HTTP/tRPC projection
- **AND** it does not own NoteSystem storage, indexing, references, tags, MIME, or rename logic

### Requirement: NoteSystem CLI SHALL be package-owned without importing app-server

The `note` CLI implementation SHALL live in `@agenter/note-system` and SHALL remain JSON-first. It MAY accept host-provided env readers for app-server-specific `AVATAR_HOME` parsing, but it MUST NOT import app-server workspace-system, runtime descriptors, or host runtime modules.

#### Scenario: Host injects avatar-home env law

- **GIVEN** app-server mounts the package-owned `note` command
- **WHEN** the command needs to resolve the active Avatar homes
- **THEN** app-server passes an env reader based on its current `AVATAR_HOME` parser
- **AND** the NoteSystem package receives explicit avatar-home paths rather than importing app-server internals

#### Scenario: JSON descriptor behavior remains available

- **WHEN** an AI runs `note write --help` or a JSON-first `note write` command
- **THEN** the package-owned CLI renders schema/help and parses JSON input with the same observable contract as before extraction
- **AND** it accepts exactly one of `content` or `contentFile`
- **AND** it requires explicit `mime`, with markdown represented as `text/markdown`
- **AND** it does not retain legacy `body` or `sourcePath` write inputs

## MODIFIED Requirements

### Requirement: NoteSystem SHALL own package-provided skill guidance

NoteSystem SHALL provide its own package-owned runtime skill from `packages/note-system/skills/**/SKILL.md`, and the app-server skill catalog SHALL aggregate it as a package-owned built-in entry. The skill SHALL teach descriptor-backed note commands for draft, write, list, show, search, tag query, SQL query, rename, MIME-aware writes, and reference validation. The skill SHALL preserve the boundary between raw notes and derived memory.

#### Scenario: Note skill is discoverable

- **WHEN** runtime skills are listed
- **THEN** a package-owned `note` skill is visible
- **AND** `skill info note` returns NoteSystem-owned guidance whose catalog metadata names `@agenter/note-system` as the owning package
- **AND** app-server does not keep a second full NoteSystem skill body as the source of truth

#### Scenario: Note skill teaches low-friction capture

- **WHEN** an AI reads the NoteSystem skill
- **THEN** it learns to prefer `note draft` for quick evidence capture when notebook/section/page naming is not worth interrupting the task
- **AND** it learns to use named `note write` only when the durable location is already clear or the ShellAssistant notebook convention applies

#### Scenario: Note skill teaches strict structured writes

- **WHEN** an AI reads the NoteSystem skill
- **THEN** it learns to search/show/query before changing an existing page when collision or reference drift is possible
- **AND** it learns that non-empty page writes require explicit `append` or `override`
- **AND** it learns to include tags, MIME, and references through structured JSON fields

## REMOVED Requirements

### Requirement: App-server-owned NoteSystem implementation

**Reason**: Keeping NoteSystem inside `packages/app-server/src/note-system` makes the host package the hidden authority for a standalone system atom.
**Migration**: Move implementation, tests, skills, dependencies, and durable package spec to `packages/note-system`; app-server imports `@agenter/note-system` and only keeps projection/wiring code.

## RENAMED Requirements
