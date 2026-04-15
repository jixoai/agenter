## Why

Agenter now relies on isolated worktrees for UI and platform work, but the repository only has ad-hoc setup habits and no durable law for closing worktrees or proving merge readiness. The problem becomes acute when `main` itself is dirty: an agent cannot honestly report “this branch merges cleanly” unless the target is a named, reproducible ref.

## What Changes

- Add official worktree lifecycle tooling for repository-local setup and cleanup.
- Add an official merge-readiness workflow that rebases onto a named target ref and verifies mergeability in a disposable clean worktree instead of touching a dirty `main`.
- Define the dirty-main policy: unpublished working-tree changes are not a valid merge target until they are materialized as a named ref.
- Update durable collaboration guidance and the local worktree skill so future sessions reuse the same workflow.

## Capabilities

### New Capabilities
- `repo-worktree-ops`: repository-local tooling and workflow laws for creating, preparing, cleaning up, and merge-verifying Git worktrees.

### Modified Capabilities
- None.

## Impact

- `.gemini/scripts/*` worktree automation
- `.gemini/skills/worktree-manager/SKILL.md`
- `AGENTS.md` collaboration / merge-readiness rules
- Git-based review and merge workflow for feature branches
