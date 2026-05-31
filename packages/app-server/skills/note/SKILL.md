---
name: note
description: Record and retrieve avatar-private raw notes through NoteSystem. Use when durable activity evidence, user corrections, terminal habits, self-evolution traces, or hosting continuity should be captured without turning them into distilled memory.
---

# note

Use this skill when you need to record or retrieve raw activity notes for the current Avatar.

Quick start:

1. Run `note --help` if the command shape is unclear.
2. Use `note draft` for quick capture when notebook, section, and page naming would interrupt the work.
3. Use `note write --notebook <name> --section <name> --page <name>` when the durable location is already clear.
4. Before changing a page that might exist, run `note search <query>` or `note show --notebook <name> --section <name> --page <name>`.
5. If a page already has content, write with `--mode append` or `--mode override`; absence of that mode is a conflict, not permission to guess.

Key laws:

- Notes are raw facts: Markdown plus frontmatter under the active `AVATAR_HOME`.
- Notes are not user models, preferences, prompt truth, or distilled memory by default.
- Legacy memory files may exist, but NoteSystem does not require them and must not mutate or migrate them unless an explicit future migration says so.
- `AVATAR_HOME` decides whether avatar-private note capability exists. If the note CLI is not projected, do not fake it with raw filesystem edits.
- `note draft` writes to the automatic `_draft/<date>/<time>` notebook/section/page path for low-friction capture.
- `note write` is strict. Search or show before writing when a collision is possible, then choose `--mode append` or `--mode override` deliberately.
- Prefer append for incremental evidence, override only when the page is clearly the same fact and replacement is intentional.
- Use `note list`, `note search`, and `note show` to recover evidence after context compaction before relying on memory.

Useful commands:

```bash
note draft "The user corrected that app-shell recording should use NoteSystem, not memory files."
note write --notebook user-fit --section corrections --page app-shell-recording --mode append "Raw correction evidence."
note list --notebook user-fit --json
note search "app-shell recording"
note show --notebook user-fit --section corrections --page app-shell-recording
```
