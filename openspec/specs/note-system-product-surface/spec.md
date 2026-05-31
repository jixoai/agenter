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

The backend SHALL expose typed NoteSystem read/search contracts over the current avatar-private capability projection. The contracts SHALL derive note catalog, page, and search projections from the current `AVATAR_HOME` roots and SHALL NOT let Studio or client code read raw filesystem paths directly.

#### Scenario: Note catalog exposes notebook section page shape

- **GIVEN** notes exist under the current readable Avatar homes
- **WHEN** a client reads the NoteSystem catalog
- **THEN** the response groups pages by notebook and section
- **AND** each page record includes notebook, section, page, path, created time, updated time, and source workspace metadata when available

#### Scenario: Note page read returns one note fact

- **WHEN** a client requests one note by notebook, section, and page
- **THEN** the backend returns the parsed metadata, Markdown body, and source path for that page
- **AND** missing pages return an explicit not-found result rather than an empty fake note

#### Scenario: Note search uses local note facts

- **WHEN** a client searches notes
- **THEN** the backend uses the local NoteSystem search implementation over readable Avatar homes
- **AND** the result contains notebook, section, page, score, snippet, and path metadata
- **AND** the contract does not require Meilisearch, Chroma, a database server, or network access

### Requirement: NoteSystem SHALL own package-provided skill guidance

NoteSystem SHALL provide its own package-owned runtime skill under the app-server skill catalog. The skill SHALL teach when and how to use `note draft`, `note write`, `note list`, `note show`, and `note search`, and SHALL preserve the boundary between raw notes and derived memory.

#### Scenario: Note skill is discoverable

- **WHEN** runtime skills are listed
- **THEN** a package-owned `note` skill is visible
- **AND** `skill info note` returns NoteSystem-owned guidance rather than relying on the general runtime skill to explain notes

#### Scenario: Note skill teaches low-friction capture

- **WHEN** an AI reads the NoteSystem skill
- **THEN** it learns to prefer `note draft` for quick evidence capture when notebook/section/page naming is not worth interrupting the task
- **AND** it learns to use named `note write` only when the durable location is clear

#### Scenario: Note skill teaches strict writes

- **WHEN** an AI reads the NoteSystem skill
- **THEN** it learns to search/show before changing an existing page when collision is possible
- **AND** it learns that non-empty page writes require explicit `append` or `override`

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
