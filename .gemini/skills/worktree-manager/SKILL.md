# worktree-manager Skill

## Description

Use this skill to create, verify, and retire Git worktrees without polluting the user's primary checkout. This skill is the canonical repo-local workflow for isolated implementation and merge readiness.

## Commands

### 1. Create and prepare a worktree

```bash
./.gemini/scripts/wt-setup.sh <topic> [branch] [base-ref]
```

- Creates `.worktree/<topic>` from the Git common root.
- Defaults the branch to `feature/<topic>` when omitted.
- Runs `bun install` unless `--skip-install` is passed.

### 2. Verify merge readiness before claiming “ready to merge”

```bash
./.gemini/scripts/wt-merge-verify.sh [--target origin/main] [--report-file /tmp/report.txt]
```

This workflow is mandatory before merge:
1. run against a **named target ref**;
2. rebase the current feature branch onto that ref;
3. run a disposable `--no-commit` merge simulation in a clean verification worktree;
4. report the verified target ref, feature branch, and feature HEAD.

### 3. Close and clean up a worktree

```bash
./.gemini/scripts/wt-clean.sh <topic-or-path> [--delete-branch] [--target origin/main]
```

- Refuses dirty worktrees unless `--force-dirty` is provided.
- Refuses deleting unmerged branches unless `--force-branch` is provided.
- Runs `git worktree prune` after removal.

## Policy

- A dirty working tree is **not** a merge target.
- If local `main` edits matter, turn them into a named branch/ref first, then verify against that ref.
- Never switch to the user’s dirty `main` checkout just to test a merge.
- Cleanup is destructive and must stay safety-gated.

## Evidence

When reporting merge readiness, always include:
- target ref used for verification
- current branch name
- current HEAD commit after rebase
- whether failure happened during rebase or merge simulation
