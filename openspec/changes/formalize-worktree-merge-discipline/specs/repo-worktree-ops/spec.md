## ADDED Requirements

### Requirement: Repository worktree setup uses the Git common root

The repository SHALL provide a setup script that can be invoked from either the primary checkout or any child worktree and still create the new worktree under the shared `.worktree/` directory at the Git common root. The setup flow SHALL prepare the new worktree for development, including dependency installation and repo-local tool linking.

#### Scenario: Creating a named isolated worktree

- **WHEN** the operator runs the setup script with a topic name and branch name from any checkout attached to the repository
- **THEN** the script creates `.worktree/<topic>` under the Git common root
- **THEN** the script creates or checks out the requested branch in that worktree
- **THEN** the script prepares the environment and prints the canonical worktree path for follow-up commands

### Requirement: Repository worktree cleanup is safety-gated

The repository SHALL provide a cleanup script that removes a named worktree only after it validates the target path and local state. The cleanup flow SHALL refuse to discard dirty worktrees or delete unmerged branches unless the operator passes explicit force options.

#### Scenario: Cleaning up a merged clean worktree

- **WHEN** the operator runs the cleanup script for a clean worktree whose branch is already merged into the chosen target ref
- **THEN** the script removes the worktree, prunes stale Git worktree metadata, and may delete the merged branch when requested

#### Scenario: Refusing unsafe cleanup

- **WHEN** the operator targets a dirty worktree or requests branch deletion for a branch that is not merged
- **THEN** the script exits non-zero with a message explaining which safety gate blocked cleanup
- **THEN** the script does not remove the worktree or delete the branch unless the operator reruns with explicit force flags

### Requirement: Merge readiness is verified against a named target ref

The repository SHALL provide a merge-verification script that reports merge readiness only against an explicit Git ref. The script SHALL require a clean feature worktree, fetch the target ref, rebase the current branch onto that ref, run a no-commit merge simulation inside a disposable clean verification worktree, and emit an objective report containing the feature branch, HEAD commit, target ref, and verification outcome.

#### Scenario: Reporting a clean merge verification

- **WHEN** the current feature branch rebases cleanly onto the named target ref and the disposable verification worktree merges without conflicts
- **THEN** the script exits successfully
- **THEN** the report states that the branch is verified against that named target ref
- **THEN** the disposable verification worktree is removed after the simulation completes

#### Scenario: Reporting rebase or merge conflicts

- **WHEN** rebasing onto the named target ref or the disposable merge simulation encounters conflicts
- **THEN** the script exits non-zero
- **THEN** the report identifies whether the failure happened during rebase or merge simulation
- **THEN** the script does not claim the branch is ready to merge

### Requirement: Dirty main is not treated as a merge target

The repository workflow SHALL treat unpublished dirty working-tree changes as non-verifiable merge targets. The merge-verification script and durable guidance SHALL instruct operators to verify against `origin/main` or another named ref, and SHALL require a separate named branch/ref if unpublished `main` changes must be included in the verification target.

#### Scenario: Main contains unpublished local edits

- **WHEN** the operator wants to prove merge readiness while the local `main` checkout contains uncommitted changes
- **THEN** the workflow reports readiness only against a named ref such as `origin/main`
- **THEN** the workflow instructs the operator to materialize local `main` changes into a named branch/ref before those changes can become a valid verification target
