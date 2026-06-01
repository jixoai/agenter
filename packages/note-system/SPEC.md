# @agenter/note-system

## Purpose

`@agenter/note-system` owns avatar-private raw notes. It is a standalone system atom: app-server may project it into a runtime, but app-server does not own note identity, storage, search, references, tags, MIME, or rename behavior.

## Laws

- Note identity is `notebook -> section -> page`, with stable SQLite-backed `bookId`, `sectionId`, and `pageId`.
- Human-readable artifacts stay under the active writable `AVATAR_HOME` as `notes/<notebook>/<section>/<page>.*`; the SQLite index is the authority for IDs, tags, references, MIME metadata, and rename safety.
- The package owns the JSON-first `note` CLI implementation. Hosts may inject their env parser, but NoteSystem must not import app-server runtime or workspace internals.
- The package owns the built-in `note` skill under `skills/note/SKILL.md`.
- Notes are raw facts, not distilled memory or prompt truth. Any memory/model projection must be created by a separate system.
- Writes and drafts require an explicit `mime`; Markdown is represented as `text/markdown`.
- Writes and drafts accept exactly one content source: inline `content` or file-backed `contentFile`. Binary-like MIME writes require `contentFile`.
- Existing user note artifacts must not be rewritten during package extraction or indexing unless an explicit write, rename, or normalization action requested it.

## Public Surface

- Storage/index APIs: write, draft, list, show, search, tag listing, read-only SQL query, and rename.
- Typed inspection facades: catalog, page read, search, tag catalog, SQL query, write, and rename projections.
- CLI APIs: `createNoteCommand`, descriptor-backed JSON command handling, and `projectNoteCliCapabilities`.
- Types: note identity, metadata, page, capability state, references, tags, SQL outputs, and CLI projections.
