---
name: note
description: Record, query, and maintain avatar-private raw notes through NoteSystem. Use when durable activity evidence, user corrections, terminal habits, ShellAssistant continuity, references, tags, or rename-safe note facts should be captured without turning them into distilled memory.
---

# note

Use this skill when you need to record or retrieve raw activity notes for the current Avatar.

Quick start:

1. Run `note --help` or `note <subcommand> --help` to inspect the current JSON schema.
2. Use `note draft` with JSON input for quick capture when notebook, section, and page naming would interrupt the work.
3. Use `note write` with JSON input when the durable location is clear.
4. Before changing a page that might exist, run `note search`, `note show`, or `note query`.
5. If a page already has content, write with `mode:"append"` or `mode:"override"`; absence of that mode is a conflict, not permission to guess.

Key laws:

- Notes are raw facts backed by NoteSystem, not user models, preferences, prompt truth, or distilled memory by default.
- `AVATAR_HOME` decides whether avatar-private note capability exists. If the note CLI is not projected, do not fake it with raw filesystem edits.
- The AI-facing contract is JSON-first, matching the runtime CLI law used by other systems.
- Human-inspectable artifacts remain on disk, but stable identity comes from SQLite: `bookId`, `sectionId`, `pageId`, tag IDs, and reference edges.
- `note draft` writes to the automatic `_draft/<date>/<time>` notebook/section/page path for low-friction capture.
- `note write` is strict. Search or show before writing when a collision is possible, then choose `append` or `override` deliberately.
- Every write/draft payload must include `mime`. Markdown is `text/markdown`.
- Use exactly one content source: `content` for inline text-like payloads, or `contentFile` for a file already produced by a script/download.
- Tags are first-class grouping facts. Use them for cross-section grouping without changing the notebook -> section -> page hierarchy.
- References should point at notes through `note:<notebook>/<section>/<page>` or stable IDs. Markdown relative links are normalized when a page is written.
- `note rename` changes human labels and file artifacts while preserving stable IDs and database reference edges.
- `note query` is read-only SQL over bounded NoteSystem views; use it for flexible inspection, never mutation.
- `application/json` is parsed and compacted. Binary-like MIME writes require `contentFile`; do not pass raw binary as inline `content`.

ShellAssistant convention:

- Use notebook `shell-assistant-book` for ShellAssistant continuity.
- Recommended sections are adaptive zones, not legacy memory files:
  - `meta-core`: compact high-level user state, relationship dynamics, and active objective framing.
  - `working-context`: current task facts, blockers, recent decisions, and handoff-like continuity.
  - `semantic-rules`: distilled-but-still-note-level rules, preferences, environment facts, and reusable patterns.
  - `episodic-archive`: dated raw task episodes and evidence records.
- Use tags such as `terminal`, `preference`, `objective`, `blocker`, `decision`, `environment`, or `role-dynamic` when they help future retrieval.

Canonical examples:

```bash
note draft '{"content":"The user corrected that app-shell recording should use NoteSystem, not memory files.","mime":"text/markdown"}'
```

```bash
note write '{
  "notebook": "shell-assistant-book",
  "section": "working-context",
  "page": "current-task",
  "content": "Upgrade NoteSystem first, then return to app-shell ShellAssistant.mdx.",
  "mime": "text/markdown",
  "mode": "append",
  "tags": ["task", "decision"]
}'
```

```bash
note write '{
  "notebook": "shell-assistant-book",
  "section": "episodic-archive",
  "page": "downloaded-trace",
  "contentFile": "/tmp/trace.json",
  "mime": "application/json",
  "tags": ["evidence"]
}'
```

```bash
note search '{"query":"app-shell NoteSystem", "tags":["decision"], "limit":10}'
note tags '{"notebook":"shell-assistant-book", "section":"semantic-rules"}'
note query '{"sql":"select notebook, section, page, updatedAt from note_pages_view order by updatedAt desc"}'
note show '{"notebook":"shell-assistant-book", "section":"working-context", "page":"current-task"}'
note rename '{"notebook":"shell-assistant-book", "section":"working-context", "page":"current", "toPage":"current-task"}'
```
