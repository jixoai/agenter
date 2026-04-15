## 1. Worktree lifecycle tooling

- [x] 1.1 Add a shared Bash helper that resolves the Git common root and reusable worktree path helpers.
- [x] 1.2 Add or upgrade the repo-local worktree setup script so it creates `.worktree/<topic>` from the common root and prepares the new environment.
- [x] 1.3 Add a repo-local worktree cleanup script with dirty-state and merged-branch safety gates plus explicit force options.

## 2. Merge verification tooling

- [x] 2.1 Add a repo-local merge-verification script that fetches a named target ref, rebases the current branch, and runs a disposable no-commit merge simulation.
- [x] 2.2 Make the merge-verification output explicitly report the named target ref, HEAD commit, and whether verification succeeded or failed during rebase or merge simulation.
- [ ] 2.3 Add a repo-local landing script that snapshots dirty target state, requires a fast-forward feature ref, lands it with `git merge --ff-only`, restores only non-overlapping dirty paths, and reports skipped overlaps.

## 3. Durable workflow guidance

- [x] 3.1 Add or update the local worktree skill so it documents setup, cleanup, and merge-verification usage.
- [x] 3.2 Update durable best-practice guidance with the dirty-main policy and the required rebase-before-merge workflow.
- [x] 3.3 Run targeted verification for the new scripts and record the verified results in this task list. Verified `wt-setup.sh --help`, `wt-clean.sh --help`, `wt-merge-verify.sh --help`, `wt-setup.sh sample-topic --dry-run`, `wt-clean.sh ui-decarding --dry-run` safety refusal, and `wt-merge-verify.sh --target origin/main --report-file /tmp/ui-decarding-merge-report.txt` with PASS.
- [ ] 3.4 Update the durable operator guidance for the landing step and record targeted verification for the landing script.
