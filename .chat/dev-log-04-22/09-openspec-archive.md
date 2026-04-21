## Step

archive `workspace-first-runtime-tool-surface`

## Request

finish the OpenSpec lifecycle for the workspace-first runtime tool surface after implementation and verification are complete.

## Evidence

- `openspec status --change "workspace-first-runtime-tool-surface" --json`
  - `schemaName: spec-driven`
  - `isComplete: true`
  - all artifacts are `done`
- `tasks.md`
  - all checklist items are marked `- [x]`
- delta spec assessment
  - corresponding main specs already contain the workspace-first law in their durable expanded form
  - no additional product-code changes were needed before archive

## Archive Target

- `openspec/changes/archive/2026-04-22-workspace-first-runtime-tool-surface/`

## Notes

- archive is intentionally separated from the implementation/test commit.
- unrelated dirty worktree changes were left untouched.
