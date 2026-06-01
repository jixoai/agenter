# runtime-system-cli-projection Specification

## Purpose

Define workspace instance env/capability driven CLI projection for runtime systems, including SkillSystem and NoteSystem.
## Requirements
### Requirement: Runtime systems SHALL register CLIs through workspace capability projection

Runtime systems SHALL declare CLI providers as workspace capability projections. When a workspace instance is created or its env changes, WorkspaceSystem SHALL offer that workspace instance to registered systems. Each system SHALL decide whether to project one or more CLI bindings into that workspace by inspecting the workspace instance env and capabilities.

The runtime kernel SHALL treat the resulting CLI list as a `CapabilityProjection`. Registering or removing a CLI binding SHALL NOT by itself mutate external world state. This projection law applies to systems added in this change, such as SkillSystem and NoteSystem; it does not require renaming the existing `root_bash` command surface in the first apply.

#### Scenario: System projects CLI when workspace supports it

- **GIVEN** a workspace instance has non-empty `AVATAR_HOME`
- **AND** a system declares that its CLI requires avatar-private capability
- **WHEN** WorkspaceSystem computes CLI projections
- **THEN** the system may register its CLI in that workspace
- **AND** the projection records the workspace instance and capability requirement that made it available

#### Scenario: System withholds CLI when workspace lacks capability

- **GIVEN** a workspace instance has empty `AVATAR_HOME`
- **AND** a system declares that its CLI requires avatar-private capability
- **WHEN** WorkspaceSystem computes CLI projections
- **THEN** that CLI is not registered in the workspace
- **AND** the system does not fall back to a hard-coded root workspace path

#### Scenario: CLI projection is not a hidden effect

- **WHEN** a workspace instance gains or loses a projected CLI
- **THEN** runtime inspection reports a capability projection change
- **AND** no message, terminal input, file write, or activity log entry is created unless a later explicit action requests it

### Requirement: Systems SHALL not encode root-workspace permission as a hard-coded special case

Systems that provide CLIs or source roots SHALL express their requirements as capability predicates over workspace instance env. They MUST NOT grant private capability merely because a workspace is named root, launched from the app shell, or selected as the current project workspace. Existing visible bash tool names remain out of first-apply scope unless a separate change explicitly redesigns that command surface.

#### Scenario: Root-named workspace without AVATAR_HOME gets no private CLI

- **GIVEN** a workspace instance has alias `root`
- **AND** its `AVATAR_HOME` is empty
- **WHEN** systems evaluate CLI projection
- **THEN** avatar-private CLIs are not projected
- **AND** alias `root` does not grant permission by itself

#### Scenario: Non-root workspace with AVATAR_HOME can receive private CLI

- **GIVEN** a mounted project workspace instance has `AVATAR_HOME=/avatar/user`
- **WHEN** systems evaluate CLI projection
- **THEN** systems that require avatar-private capability may project their CLIs into that workspace
- **AND** the workspace does not need to become a root workspace category

### Requirement: NoteSystem SHALL model human notes rather than memory

The near-term human activity journal system SHALL use the `noteSystem` name. NoteSystem SHALL record fragmented notes, diary-like facts, and lightweight activity records as human actions. Note CLI projection MAY require avatar-private capability when the note target is Avatar-private; if `AVATAR_HOME` is empty, Avatar-private note CLI bindings MUST NOT be projected. Notes SHALL remain human-inspectable artifacts, but their durable identity, tags, references, MIME metadata, and query projections SHALL be backed by a NoteSystem-owned SQLite index instead of treating file paths as the only identity authority.

#### Scenario: Avatar-private note CLI requires AVATAR_HOME

- **GIVEN** NoteSystem provides a CLI for writing Avatar-private notes
- **WHEN** a workspace instance has empty `AVATAR_HOME`
- **THEN** the Avatar-private note CLI is not projected

#### Scenario: Note is not treated as memory

- **WHEN** NoteSystem records a note
- **THEN** the entry is stored as a note fact
- **AND** it is not presented as a distilled memory or user model unless a later memory derivation system explicitly creates that projection

#### Scenario: Note identity is not only a path

- **WHEN** NoteSystem indexes or writes a note page
- **THEN** the page receives stable internal identity metadata
- **AND** later rename or reference operations use that identity instead of relying only on current file path text

### Requirement: NoteSystem SHALL organize notes as notebook section page

NoteSystem SHALL model note identity as `notebook -> section -> page`. A page SHALL have stable internal IDs for notebook/book, section, and page, plus human-readable labels for notebook, section, and page. The hierarchy SHALL be reflected in storage under the active writable Avatar home using human-inspectable files when possible, but SQLite-backed identity SHALL be the authority for rename, references, tags, and SQL query.

Notebook, section, and page names MAY contain normal Unicode. They MUST reject empty strings, `/`, `\`, `..`, control characters, and any segment that escapes the note root. `_draft` SHALL be reserved for the special draft notebook.

#### Scenario: Page is addressed by notebook section page

- **GIVEN** `AVATAR_HOME` resolves a writable active Avatar home
- **WHEN** a caller writes page `ideas/shell/env-first`
- **THEN** NoteSystem stores one page under notebook `ideas`, section `shell`, and page `env-first`
- **AND** the result includes stable `bookId`, `sectionId`, `pageId`, created time, updated time, tags, references, MIME metadata, and source workspace when available

#### Scenario: Unsafe note path segment is rejected

- **WHEN** a caller uses `../escape` as notebook, section, or page
- **THEN** NoteSystem rejects the request
- **AND** no note file is created or modified outside the note root

#### Scenario: Human-readable artifact remains inspectable

- **WHEN** an operator opens a markdown note artifact on disk
- **THEN** the body remains readable markdown
- **AND** frontmatter or sidecar metadata points back to the stable NoteSystem identity

### Requirement: NoteSystem SHALL provide a draft notebook shortcut

NoteSystem SHALL include a special automatic draft notebook for low-friction capture. `note draft` SHALL write to that notebook without requiring the caller to choose notebook, section, or page names. Draft sections SHALL be date-based by day, and draft page names SHALL be high-precision time plus a short id, using a shape equivalent to `<active-avatar-home>/notes/_draft/<YYYY-MM-DD>/<time-page>.md`.

#### Scenario: Draft note creates date section and time page

- **GIVEN** `AVATAR_HOME` resolves a writable active Avatar home
- **WHEN** a caller runs `note draft` at `2026-05-31T15:30:00Z`
- **THEN** NoteSystem writes into the special draft notebook
- **AND** the section is based on `2026-05-31`
- **AND** the page name is based on capture time plus a short id to avoid ordinary collisions

#### Scenario: Draft note avoids naming decisions

- **WHEN** a caller runs `note draft` with note body content
- **THEN** the caller does not need to provide notebook, section, or page names
- **AND** NoteSystem still returns the concrete page identity and path it created

### Requirement: Note CLI SHALL be strict about page write conflicts

Note CLI writes SHALL be strict. If a target page exists and is non-empty, the write MUST fail unless the caller explicitly declares append mode or override mode. The default write mode SHALL NOT guess between append and override. `note draft` normally creates a new time/id page and therefore does not require append or override mode.

#### Scenario: Non-empty page write without mode fails

- **GIVEN** a note page already exists with non-empty Markdown body
- **WHEN** a caller runs `note write` for that page without append or override mode
- **THEN** NoteSystem returns a conflict error
- **AND** the existing page content remains unchanged

#### Scenario: Append mode appends to non-empty page

- **GIVEN** a note page already exists with non-empty Markdown body
- **WHEN** a caller writes to that page with append mode
- **THEN** NoteSystem appends the new Markdown content
- **AND** it updates page metadata without discarding the previous body

#### Scenario: Override mode replaces non-empty page

- **GIVEN** a note page already exists with non-empty Markdown body
- **WHEN** a caller writes to that page with override mode
- **THEN** NoteSystem replaces the Markdown body
- **AND** it preserves enough metadata to keep the page identity stable

### Requirement: Script capability SHALL remain a source projection until it earns full System status

Script management SHALL initially be modeled as script source/home projection, not as a required full `scriptSystem`. A full script system SHALL NOT be introduced until the design defines lifecycle ownership, execution policy, provenance, and inspection/router contracts.

#### Scenario: Script source projection does not imply full system

- **WHEN** a workspace exposes ts/js/py/sh script roots
- **THEN** WorkspaceSystem may expose those roots as script sources
- **AND** the runtime does not claim that a durable script system exists without lifecycle and router contracts

#### Scenario: Script execution requires explicit policy

- **WHEN** a caller requests execution of a discovered script
- **THEN** the runtime requires an explicit execution policy and action path
- **AND** source discovery alone does not grant execution permission

### Requirement: Note CLI SHALL use runtime JSON tool descriptor law

NoteSystem SHALL expose its AI-facing CLI through the same descriptor-backed JSON command law used by runtime tool namespaces. The primary contract SHALL accept empty input, one JSON argv payload, or JSON stdin as defined by the shared runtime CLI parser. Positional `note write --notebook ...` style commands MAY remain as a temporary compatibility surface only when deterministic tests preserve it, but the note skill and ShellAssistant prompt MUST teach the JSON descriptor form.

The command implementation and note capability helper SHALL be owned by `@agenter/note-system`. Runtime hosts MAY inject their current `AVATAR_HOME` env parser, but NoteSystem MUST NOT import app-server workspace-system or runtime internals.

#### Scenario: Note command accepts JSON object input

- **GIVEN** `AVATAR_HOME` resolves a writable active Avatar home
- **WHEN** an AI invokes `note write '{"notebook":"ideas","section":"shell","page":"env-first","content":"raw fact"}'`
- **THEN** NoteSystem parses the request through a typed descriptor input schema
- **AND** the result is a structured JSON-compatible page metadata object

#### Scenario: Note help is descriptor-backed

- **WHEN** a caller runs `note write --help`
- **THEN** the runtime renders the note write JSON schema, examples, and compact field guidance from the runtime descriptor
- **AND** the help text does not hand-maintain a divergent flag grammar

#### Scenario: Note CLI projection still depends on AVATAR_HOME

- **GIVEN** a workspace instance has empty `AVATAR_HOME`
- **WHEN** WorkspaceSystem computes CLI projections
- **THEN** the Avatar-private `note` command is not projected
- **AND** descriptor-backed note commands do not fall back to root workspace or project workspace paths

#### Scenario: Note command consumes host env as an injected boundary

- **GIVEN** app-server projects `note` for a workspace with non-empty `AVATAR_HOME`
- **WHEN** the command resolves avatar-private note roots
- **THEN** app-server supplies the current env parser to `@agenter/note-system`
- **AND** the package-owned command receives explicit avatar-home paths without importing app-server internals

### Requirement: Note skill SHALL bind to descriptor-backed commands

The package-owned `note` skill SHALL teach the descriptor-backed `note` command shape and SHALL prefer `skill info note` / `note <subcommand> --help` over memorized flag recipes. The skill SHALL describe raw note use, strict write conflicts, tags, references, rename, MIME, SQL query, and ShellAssistant notebook conventions without pretending notes are distilled memory.

#### Scenario: AI learns JSON command shape from note skill

- **WHEN** an AI reads `skill info note`
- **THEN** the skill shows JSON examples for writing, searching, querying tags, renaming, and resolving references
- **AND** it tells the AI to run note help for the exact current schema before high-risk writes

#### Scenario: Note skill names ShellAssistant notebook convention

- **WHEN** an AI needs to record ShellAssistant evidence
- **THEN** the note skill recommends the notebook `shell-assistant-book`
- **AND** it recommends sections as adaptive note zones rather than legacy memory-pack files
