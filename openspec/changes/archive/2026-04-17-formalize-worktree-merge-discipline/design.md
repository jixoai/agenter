## Context

The current repository already benefits from isolated worktrees for frontend capture and parallel work, but the lifecycle is incomplete. A setup script exists only as an untracked local experiment on `main`, cleanup is still manual, and merge-readiness checks are informal. At the same time, `main` often contains unpublished working-tree edits, which means “rebased onto main” and “safe to merge into main” are currently ambiguous statements unless the target is defined precisely.

This change needs to produce durable repo-local tooling that works from either the primary checkout or any child worktree, without mutating the user’s dirty `main` state.

## Goals / Non-Goals

**Goals:**
- Provide a canonical script to create and prepare a named worktree from the repository common root.
- Provide a canonical script to close and clean up a named worktree with explicit safety checks.
- Provide a canonical script to verify merge readiness against a named target ref using `fetch + rebase + disposable merge simulation`.
- Document the rule that dirty `main` is not a verifiable merge target until it becomes a named branch/ref.
- Update durable best-practice material so future sessions reuse the same workflow.

**Non-Goals:**
- Auto-resolving rebase or merge conflicts.
- Auto-committing or auto-stashing dirty `main` changes on the user’s behalf.
- Building a generalized multi-repo release manager.

## Decisions

### 1. Use a shared shell helper for common-root discovery

The scripts will share a small Bash helper that resolves the Git common directory and common repository root. This avoids the current `git rev-parse --show-toplevel` trap, which returns the current worktree root and would incorrectly create nested `.worktree` folders when invoked from a child worktree.

Alternative considered:
- Recompute paths independently in each script. Rejected because the bug-prone path logic would be duplicated and drift over time.

### 2. Keep the public lifecycle surface as repo-local scripts

The canonical entrypoints will live under `.gemini/scripts/`:
- `wt-setup.sh`
- `wt-clean.sh`
- `wt-merge-verify.sh`

This keeps the workflow close to the repo and aligned with existing `ui-capture.sh` usage.

Alternative considered:
- Move everything into a global user-level skill or external CLI. Rejected because merge readiness depends on repo-local conventions such as `.worktree/`, target branch defaults, and AGENTS discipline.

### 3. Verify merge readiness in a disposable clean worktree

`wt-merge-verify.sh` will:
1. require a clean feature worktree;
2. fetch the named target ref;
3. rebase the current branch onto that target ref;
4. create a disposable verification worktree from the target ref;
5. run `git merge --no-commit --no-ff <feature-branch>` there;
6. emit an objective report and tear the verification worktree down.

This is preferred over checking against local `main`, because local `main` may be dirty and therefore non-reproducible.

Alternatives considered:
- Use only `git merge-tree`. Rejected because a real worktree merge simulation is easier to audit, mirrors the actual merge machinery, and makes cleanup/reporting more legible.
- Switch to `main` and test there. Rejected because it would mutate or block on the user’s dirty working tree.

### 4. Dirty `main` is policy, not a hidden edge case

The workflow will explicitly state: a dirty working tree is not a merge target. If unpublished `main` edits matter, the owner must first turn them into a named ref (for example a temporary branch), then run merge verification against that ref.

Alternative considered:
- Auto-snapshot dirty `main` into a temporary commit. Rejected because that silently mutates user state and makes provenance harder to reason about.

### 5. Best-practice updates belong in both AGENTS and the local worktree skill

`AGENTS.md` will carry the durable repo-level law, while `.gemini/skills/worktree-manager/SKILL.md` will carry the operator-facing command workflow. This mirrors the existing split between durable collaboration rules and execution shortcuts.

### 6. Verified landing into dirty main needs its own script

The repository needs a separate landing script for the step after verification:
1. snapshot the current target checkout's dirty state into a named ref without mutating the worktree;
2. back up the dirty paths to a temporary directory for local recovery;
3. require that the feature ref is a fast-forward descendant of the clean target HEAD;
4. clean the target checkout just enough to perform `git merge --ff-only`;
5. restore only the dirty paths that do not overlap with files changed by the landed feature;
6. report the snapshot ref, backup directory, restored paths, and skipped overlapping paths.

This keeps the "dirty target is not a merge target" law intact while still giving operators a reproducible way to land a verified branch onto a dirty `main` checkout.

Alternatives considered:
- Continue doing the landing step manually. Rejected because the workflow becomes agent-dependent and easy to mis-execute.
- Auto-restore overlapping dirty paths after landing. Rejected because it can silently overwrite the just-landed branch state with stale local drafts.

## Risks / Trade-offs

- [Risk] Bash tooling can be brittle across shells and path shapes. → Mitigation: use `bash`, `set -euo pipefail`, common helper functions, and explicit validation messages.
- [Risk] Rebase verification is inherently stateful and can stop on conflicts. → Mitigation: require a clean feature worktree up front, exit non-zero on conflict, and leave the branch in the standard Git rebase state for manual resolution.
- [Risk] Verification against `origin/main` does not prove compatibility with unpublished `main` edits. → Mitigation: document and enforce the named-target-ref rule.
- [Risk] Cleanup can accidentally remove a worktree with unsaved local changes. → Mitigation: `wt-clean.sh` refuses dirty worktrees or unmerged branch deletion unless the user passes explicit force flags.
- [Risk] Landing onto dirty `main` can reintroduce stale drafts over the newly landed feature. → Mitigation: restore only non-overlapping dirty paths by default and explicitly report skipped overlaps.

## Migration Plan

1. Add the shared helper and the three repo-local scripts.
2. Add/update the local worktree skill so new sessions can discover the workflow.
3. Update `AGENTS.md` with the durable merge-readiness law.
4. Verify the scripts with `--help` and targeted dry-run / real checks in the current repository.

Rollback is straightforward: remove the added scripts and documentation, because this change does not migrate runtime data or persistent schemas.

## Open Questions

- None at this stage; the remaining work is implementation and verification.
