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

The near-term human activity journal system SHALL use the `noteSystem` name. NoteSystem SHALL record fragmented notes, diary-like facts, and lightweight activity records as human actions. Note CLI projection MAY require avatar-private capability when the note target is Avatar-private; if `AVATAR_HOME` is empty, Avatar-private note CLI bindings MUST NOT be projected. Notes SHALL be stored as human-readable Markdown files with frontmatter.

#### Scenario: Avatar-private note CLI requires AVATAR_HOME

- **GIVEN** NoteSystem provides a CLI for writing Avatar-private notes
- **WHEN** a workspace instance has empty `AVATAR_HOME`
- **THEN** the Avatar-private note CLI is not projected

#### Scenario: Note is not treated as memory

- **WHEN** NoteSystem records a note
- **THEN** the entry is stored as a note fact
- **AND** it is not presented as a distilled memory or user model unless a later memory derivation system explicitly creates that projection

### Requirement: NoteSystem SHALL organize notes as notebook section page

NoteSystem SHALL model note identity as `notebook -> section -> page`. A page SHALL be one Markdown document with frontmatter. The hierarchy SHALL be reflected in storage under the active writable Avatar home, using a shape equivalent to `<active-avatar-home>/notes/<notebook>/<section>/<page>.md`, so operators can inspect and edit notes as files.

Notebook, section, and page names MAY contain normal Unicode. They MUST reject empty strings, `/`, `\`, `..`, control characters, and any segment that escapes the note root. `_draft` SHALL be reserved for the special draft notebook.

#### Scenario: Page is addressed by notebook section page

- **GIVEN** `AVATAR_HOME` resolves a writable active Avatar home
- **WHEN** a caller runs `note write --notebook ideas --section shell --page env-first`
- **THEN** NoteSystem writes one Markdown page under notebook `ideas`, section `shell`, and page `env-first`
- **AND** the page frontmatter records stable note metadata such as id, created time, updated time, notebook, section, page, tags, and source workspace when available

#### Scenario: Unsafe note path segment is rejected

- **WHEN** a caller uses `../escape` as notebook, section, or page
- **THEN** NoteSystem rejects the request
- **AND** no note file is created or modified outside the note root

#### Scenario: Markdown frontmatter remains user editable

- **WHEN** an operator opens a stored note page
- **THEN** the body is readable Markdown
- **AND** the frontmatter contains structured metadata without requiring an external database to understand the page identity

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

### Requirement: Note search SHALL use lightweight local JavaScript search

Note search SHALL use an in-process JavaScript fuzzy/full-text search implementation suitable for local notes, with MiniSearch as the default candidate unless implementation evidence favors another lightweight library such as Fuse or fuzzy. Note search SHALL NOT require a heavyweight external search service.

By default, note commands SHALL operate on the current workspace group. All-workspace or all-runtime note search MAY be added later as an explicit option, but it SHALL NOT be the default behavior for this change.

#### Scenario: Note search returns local results

- **GIVEN** notes exist under the active readable Avatar homes
- **WHEN** a caller runs `note search "query"`
- **THEN** NoteSystem indexes or scans local Markdown/frontmatter content with a lightweight JS search implementation
- **AND** it returns matching notebook, section, page, path, score, and snippet metadata

#### Scenario: Note list and show use current workspace group by default

- **GIVEN** another mounted workspace has different Avatar-home notes
- **WHEN** a caller runs `note list` or `note show` in the active workspace group
- **THEN** NoteSystem reads from the active workspace group's readable Avatar homes by default
- **AND** it does not mix notes from unrelated mounted workspace groups unless an explicit future all-workspaces option is used

#### Scenario: Note search does not require external service

- **WHEN** NoteSystem search runs in a local runtime
- **THEN** it does not require Meilisearch, Chroma, a database server, or network access

#### Scenario: NoteSystem validates the basic capability projection path

- **GIVEN** NoteSystem is simpler than SkillSystem because it does not need directory-level skill-source mixing
- **WHEN** NoteSystem and SkillSystem are both implemented under this change
- **THEN** NoteSystem validates the basic `AVATAR_HOME` capability projection path
- **AND** SkillSystem validates the advanced `SKILLS_HOME` multi-source projection path

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
