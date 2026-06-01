# note-system-product-surface Specification

## Purpose

Define NoteSystem as the avatar-private raw-note recording and inspection surface, including typed backend contracts, package-owned skill guidance, and real-AI validation.
## Requirements
### Requirement: NoteSystem SHALL be the avatar-private recording system

NoteSystem SHALL be the first-class system for recording raw human/action notes. A note SHALL remain a note fact stored as Markdown plus frontmatter under the active writable `AVATAR_HOME`. NoteSystem MUST NOT present notes as distilled memory, user model, or preference truth unless a later derivation system explicitly creates that projection.

#### Scenario: Note stays raw recording fact

- **WHEN** a caller records a user correction, work observation, hosting progress update, or self-evolution trace through NoteSystem
- **THEN** the persisted page is a `kind: note` Markdown/frontmatter document
- **AND** the page is not exposed as `memory`, `user-model`, or prompt truth by default

#### Scenario: Legacy memory files are not the recording API

- **GIVEN** legacy avatar memory files exist under an avatar principal root
- **WHEN** NoteSystem is used for new recording work
- **THEN** NoteSystem does not require those memory files to exist
- **AND** it does not mutate, migrate, or delete them without a separate explicit migration decision

### Requirement: NoteSystem SHALL expose typed inspection contracts

The backend SHALL expose typed NoteSystem contracts over the current avatar-private capability projection. The contracts SHALL derive note catalog, page, search, tags, references, and SQL query projections from the current `AVATAR_HOME` roots and SHALL NOT let Studio or client code read raw filesystem paths directly.

#### Scenario: Note catalog exposes notebook section page shape

- **GIVEN** notes exist under the current readable Avatar homes
- **WHEN** a client reads the NoteSystem catalog
- **THEN** the response groups pages by notebook and section
- **AND** each page record includes notebook, section, page, path or artifact metadata, stable IDs, MIME, tags, reference counts, created time, updated time, and source workspace metadata when available

#### Scenario: Note page read returns one note fact

- **WHEN** a client requests one note by stable ID or by notebook, section, and page
- **THEN** the backend returns the parsed metadata, body or content descriptor, tags, references, MIME, and source artifact information for that page
- **AND** missing pages return an explicit not-found result rather than an empty fake note

#### Scenario: Note search uses local note facts

- **WHEN** a client searches notes
- **THEN** the backend uses local NoteSystem indexed facts over readable Avatar homes
- **AND** the result contains stable IDs, notebook, section, page, score, snippet, tags, reference metadata, and artifact path when available
- **AND** the contract does not require Meilisearch, Chroma, a database server, or network access

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

### Requirement: NoteSystem SHALL have real-AI validation

The repository SHALL include a provider-gated real-AI validation scenario proving that an actual model can discover NoteSystem guidance and use the projected `note` CLI to record and retrieve a note. The test MAY be skipped when no real provider is configured, but the skip MUST be explicit and the deterministic suite MUST still cover the underlying CLI/storage contracts.

#### Scenario: Real AI follows note skill and CLI

- **GIVEN** a runtime with non-empty `AVATAR_HOME` and the `note` skill visible
- **WHEN** a real AI scenario asks the avatar to record a short durable observation
- **THEN** the avatar expands or otherwise uses the NoteSystem guidance
- **AND** it writes the note through projected `note` CLI rather than raw filesystem editing
- **AND** it verifies retrieval through `note search` or `note show`

#### Scenario: Provider gate is explicit

- **WHEN** real provider settings are absent
- **THEN** the NoteSystem real-AI test is skipped with an explicit provider-gate reason
- **AND** deterministic NoteSystem BDD remains runnable in normal CI

### Requirement: NoteSystem SHALL store stable note facts in SQLite

NoteSystem SHALL maintain a SQLite-backed note index under the active Avatar note store. The database SHALL represent notebooks/books, sections, pages, tags, page-tag edges, and page-reference edges as durable facts. File artifacts SHALL remain human-inspectable content storage, but SQLite SHALL be the query and identity authority.

#### Scenario: Write returns stable identity metadata

- **GIVEN** `AVATAR_HOME` resolves a writable active Avatar home
- **WHEN** a caller writes a note page
- **THEN** NoteSystem persists or updates the page in the SQLite index
- **AND** the write result includes `bookId`, `sectionId`, `pageId`, `tagIds`, `createdAt`, `updatedAt`, `mime`, `references`, and the current readable note URI

#### Scenario: Existing files are indexed without destructive rewrite

- **GIVEN** markdown note files already exist under readable Avatar homes
- **WHEN** NoteSystem builds its index
- **THEN** it indexes those files into stable page records
- **AND** it does not rewrite user-owned files merely because indexing occurred

### Requirement: NoteSystem SHALL expose read-only SQL query over bounded note views

NoteSystem SHALL expose an AI-facing read-only SQL query capability over bounded SQLite views or temporary tables. The query surface SHALL allow SELECT-style inspection of pages, tags, page-tag edges, and references. It MUST reject writes, schema mutation, attachment, pragma mutation, shelling out, or arbitrary filesystem access.

#### Scenario: AI queries note facts with SQL

- **GIVEN** notes, tags, and references exist
- **WHEN** an AI runs a note SQL query such as selecting recent pages with a tag
- **THEN** NoteSystem executes the query against read-only bounded views
- **AND** it returns rows with stable IDs and human-readable labels

#### Scenario: Mutating SQL is rejected

- **WHEN** a caller submits `UPDATE`, `DELETE`, `INSERT`, `DROP`, `ALTER`, `ATTACH`, or equivalent mutating SQL
- **THEN** NoteSystem rejects the query
- **AND** no note files or database records are modified

### Requirement: NoteSystem SHALL support durable tags and tag queries

NoteSystem SHALL store tags as first-class records with stable IDs and page-tag edges. The system SHALL support querying tags globally, within one notebook/book, within one section, and querying pages by one or more tags.

#### Scenario: Tags can be listed for a notebook

- **GIVEN** pages under notebook `shell-assistant-book` have tags
- **WHEN** a caller asks for notebook tags
- **THEN** NoteSystem returns the tag list with tag IDs, names, and counts scoped to that notebook

#### Scenario: Tags can be listed for a section

- **GIVEN** pages under section `working-context` have tags
- **WHEN** a caller asks for section tags
- **THEN** NoteSystem returns the tag list with tag IDs, names, and counts scoped to that section

#### Scenario: Pages can be searched by tags

- **WHEN** a caller searches for pages tagged `terminal` and `preference`
- **THEN** NoteSystem returns matching pages with stable IDs and notebook/section/page labels

### Requirement: NoteSystem SHALL support MIME-aware content writes

NoteSystem SHALL store page content with a `mime` field. The default MIME SHALL be markdown. JSON content SHALL be parsed, validated, and compacted before storage. Non-text or binary-capable content SHALL be written from a supplied file path or asset source rather than raw inline content. Unsupported MIME writes MUST fail before mutating note state.

#### Scenario: Markdown is the default MIME

- **WHEN** a caller writes a note without specifying MIME
- **THEN** NoteSystem stores it as markdown
- **AND** markdown reference extraction applies

#### Scenario: JSON content is validated and compacted

- **WHEN** a caller writes a note with MIME `application/json`
- **THEN** NoteSystem parses the JSON
- **AND** it stores a compact normalized JSON representation
- **AND** invalid JSON fails without changing the existing page

#### Scenario: Binary-like content uses source file input

- **WHEN** a caller writes a binary or non-inline MIME note
- **THEN** NoteSystem requires a source file path or equivalent asset source
- **AND** it records MIME metadata and safe storage path without treating raw CLI text as binary payload

### Requirement: NoteSystem SHALL normalize references to stable page identities

NoteSystem SHALL extract and normalize note references. Markdown content SHALL be parsed for inline and reference-style links that can resolve to note pages. Resolved links SHALL be normalized to `note:<book>/<section>/<pageName>` in markdown artifacts when a write or explicit normalization occurs, and the database SHALL store reference edges by stable IDs. Non-markdown content SHALL provide explicit references using accepted forms: stable IDs, `note:<book>/<section>/<pageName>`, or resolvable relative note paths.

#### Scenario: Markdown relative link becomes note URI and database edge

- **GIVEN** page `shell-assistant-book/working-context/current-task` links to `./my-xxx.md`
- **AND** that path resolves to a note page in the same section or notebook
- **WHEN** the page is written or normalized
- **THEN** the markdown reference target is rewritten to `note:<book>/<section>/<pageName>`
- **AND** the database stores a reference edge from source `pageId` to target `pageId`

#### Scenario: Invalid reference fails before database commit

- **WHEN** a caller writes references that cannot be resolved to stable note pages
- **THEN** NoteSystem rejects the write or reports reference validation failure according to the command mode
- **AND** it does not persist illegal reference edges

#### Scenario: Non-markdown references are explicit

- **WHEN** a caller writes JSON or another non-markdown MIME page
- **THEN** NoteSystem does not infer links from content
- **AND** it validates references supplied in explicit metadata

### Requirement: NoteSystem SHALL support rename without breaking references

NoteSystem SHALL support renaming notebooks/books, sections, and pages. Rename SHALL update human-readable labels and storage artifacts while preserving stable IDs and reference edges. If markdown artifacts contain normalized `note:<book>/<section>/<pageName>` links affected by the rename, NoteSystem SHALL either rewrite affected artifacts within the same transaction or report a bounded follow-up normalization requirement.

#### Scenario: Page rename preserves pageId and references

- **GIVEN** page A references page B
- **WHEN** page B is renamed
- **THEN** page B keeps the same `pageId`
- **AND** the reference edge from page A still points to page B
- **AND** reads show the new page label

#### Scenario: Rename conflict is rejected

- **GIVEN** a target notebook/section already contains page `env-first`
- **WHEN** a caller tries to rename another page to `env-first`
- **THEN** NoteSystem rejects the rename
- **AND** all IDs, files, and reference edges remain unchanged
