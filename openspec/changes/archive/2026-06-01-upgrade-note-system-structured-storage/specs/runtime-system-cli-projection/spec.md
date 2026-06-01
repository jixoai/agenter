## ADDED Requirements

### Requirement: Note CLI SHALL use runtime JSON tool descriptor law

NoteSystem SHALL expose its AI-facing CLI through the same descriptor-backed JSON command law used by runtime tool namespaces. The primary contract SHALL accept empty input, one JSON argv payload, or JSON stdin as defined by the shared runtime CLI parser. Positional `note write --notebook ...` style commands MAY remain as a temporary compatibility surface only when deterministic tests preserve it, but the note skill and ShellAssistant prompt MUST teach the JSON descriptor form.

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Note search SHALL use lightweight local JavaScript search

**Reason**: The user requires SQLite-backed grouping/query and AI-facing SQL over note facts. Search may still use lightweight JavaScript ranking as an implementation detail, but it is no longer the primary storage/query law.

**Migration**: Replace this requirement with SQLite-backed index/search/query requirements in `note-system-product-surface`.

## RENAMED Requirements
