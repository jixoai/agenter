# 2026-04-22 Spec Commit

- Created spec commit `238215a` with message: `docs(spec): define workspace-first runtime tool surface`.
- That commit contains only the workspace tool-surface change artifacts and durable specs:
  - `openspec/changes/workspace-first-runtime-tool-surface/*` except `tasks.md`
  - `openspec/specs/runtime-*.md`
  - `openspec/specs/workspace-system-capabilities/spec.md`
  - root `SPEC.md`
  - `packages/app-server/SPEC.md`
- Deliberately excluded unrelated dirty paths, including `flutter-chat-view` and other pending OpenSpec changes.
- Next action: create the matching implementation commit with runtime code, tests, guidance/generated artifacts, and `tasks.md` completion state.
