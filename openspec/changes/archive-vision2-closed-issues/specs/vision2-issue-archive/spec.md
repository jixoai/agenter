## ADDED Requirements

### Requirement: vision2 SHALL archive closed issue files into a sibling closed directory

The vision2 controller SHALL provide an issue-archive operation that moves every active issue file whose front-matter `state` is not `open` (i.e. `closed` or `resolved`) from `issues/` into `issues/closed/`. The archive operation SHALL be invoked via `bun run openspec:vision2 -- issues <change> --archive`. The destination directory `issues/closed/` SHALL be created if it does not exist. The archive operation SHALL NOT mutate issue file contents; it SHALL only relocate files. The archive operation SHALL be idempotent: re-running it when no archive-eligible issues remain SHALL exit 0 and report that nothing was archived.

#### Scenario: Closed issues are relocated out of the active set

- **GIVEN** a vision2 change has `issues/001-done.md` with `state: closed` and `github_issue_status: closed`
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <change> --archive`
- **THEN** the file moves to `issues/closed/001-done.md`
- **AND** the original `issues/001-done.md` no longer exists
- **AND** the command exits 0
- **AND** the command output reports that `issues/001-done.md` was archived

#### Scenario: Resolved issues are also archived

- **GIVEN** a vision2 change has `issues/002-fixed.md` with `state: resolved` and `github_issue_status: closed`
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <change> --archive`
- **THEN** the file moves to `issues/closed/002-fixed.md`
- **AND** it is no longer counted as an active issue by `check`

#### Scenario: Open issues are never moved

- **GIVEN** a vision2 change has `issues/003-open.md` with `state: open`
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <change> --archive`
- **THEN** `issues/003-open.md` stays in place
- **AND** it remains counted as an active issue by `check`

#### Scenario: Archive is idempotent

- **GIVEN** a vision2 change has no archive-eligible issues (all remaining are `state: open`, or all closed issues are already under `issues/closed/`)
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <change> --archive`
- **THEN** the command exits 0
- **AND** the output reports that nothing was archived

#### Scenario: Destination directory is created when absent

- **GIVEN** a vision2 change has an archive-eligible issue but no `issues/closed/` directory exists yet
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <change> --archive`
- **THEN** `issues/closed/` is created
- **AND** the eligible issue is moved into it

### Requirement: vision2 check SHALL remain read-only and SHALL surface the closed-issue count

The vision2 `check` command SHALL NOT mutate any issue file or move files as a side effect of validation. The `check` command SHALL continue to exclude files under `issues/closed/` from the active open-issue count. The `check` output MAY report the count of closed-but-not-yet-archived issues as an advisory hint, but the presence of closed issues in the active folder SHALL NOT cause `check` to fail or change its exit code.

#### Scenario: Check does not archive

- **GIVEN** a vision2 change has `issues/001-done.md` with `state: closed` still in the active folder
- **WHEN** `check` runs
- **THEN** the file is not moved
- **AND** `check` does not count it as an open issue
- **AND** `check` exits according to its structural + open-issue rules without archiving

### Requirement: Archive SHALL preserve the issue lifecycle evidence contract

Archived issue files SHALL retain their original filename, front matter, and body sections unchanged. Archived files SHALL remain valid under the issue standard enforced by `issues --validate` when that command is extended to scan `issues/closed/`, but SHALL be excluded from the active issue list and from `check`'s open-issue convergence count. The archive operation SHALL refuse to run against a change that does not exist and SHALL surface a clear error.

#### Scenario: Archived files keep their identity

- **GIVEN** `issues/001-done.md` has a specific `title`, `state: closed`, and a `## Resolution` section
- **WHEN** it is archived
- **THEN** `issues/closed/001-done.md` has byte-identical content to the pre-archive original
- **AND** its front matter is unchanged

#### Scenario: Archiving a missing change fails clearly

- **GIVEN** no change directory exists for the requested change name
- **WHEN** the operator runs `bun run openspec:vision2 -- issues <missing> --archive`
- **THEN** the command exits non-zero
- **AND** reports that the OpenSpec change was not found
