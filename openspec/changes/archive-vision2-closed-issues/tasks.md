## 1. Alignment / Investigation

- [ ] 1.1 Confirm `interview_plan.md` captures the closed-issue lifecycle drive and the check-must-stay-read-only constraint (see Q&A ledger Q2).
- [ ] 1.2 Confirm with user the CLI surface assumption: `issues <change> --archive` flag vs a new top-level `archive` command (User Confirmation Gate 1).

## 2. BDD Contract

- [ ] 2.1 Scenario: Given a change has a `state: closed` issue When `issues <change> --archive` runs Then the file moves to `issues/closed/` and the original is gone and exit code is 0.
- [ ] 2.2 Scenario: Given a change has a `state: resolved` issue When `--archive` runs Then it is also relocated (non-open = archive-eligible).
- [ ] 2.3 Scenario: Given a change has a `state: open` issue When `--archive` runs Then it stays in place and remains counted by `check`.
- [ ] 2.4 Scenario: Given no archive-eligible issues remain When `--archive` runs again Then exit 0 with a "nothing to archive" report (idempotent).
- [ ] 2.5 Scenario: Given `issues/closed/` does not exist When `--archive` runs Then the directory is created and the eligible issue is moved.
- [ ] 2.6 Scenario: Given an archived file When compared to its pre-archive original Then content is byte-identical (no front-matter rewrite).
- [ ] 2.7 Scenario: Given `check` runs with a closed-but-unarchived issue present Then `check` does not move the file and does not count it as open.
- [ ] 2.8 Scenario: Given a missing change name When `issues <missing> --archive` runs Then exit non-zero with a clear not-found error.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision2 -- commit-check archive-vision2-closed-issues --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [ ] 3.2 Extend `listOrValidateIssues` in `scripts/openspec/vision2-driven.ts` (or add an `archiveClosedIssues` helper) to handle the `--archive` flag: scan top-level `issues/*.md`, parse front matter, select files with `state !== open`, move them into `issues/closed/` (creating it if absent), leave open issues in place.
- [ ] 3.3 Reuse `validateIssueFile` / front-matter parsing from `scripts/openspec/utils/issues.ts` to decide archive eligibility; do not duplicate the front-matter parser.
- [ ] 3.4 Use `node:fs/promises` `rename` for the move (atomic on same filesystem); fall back to copy+unlink only if rename fails across devices (document the fallback).
- [ ] 3.5 Make the command idempotent: when no eligible files exist, print a JSON `{ ok: true, archived: [] }` report and exit 0.
- [ ] 3.6 Report each archived path in the output JSON as `{ from, to }` pairs so operators can verify the move.
- [ ] 3.7 Update `check` (if User Confirmation Gate 2 is approved) to surface a `closedUnarchived` advisory count without changing its exit code or moving files.

## 4. Verification

- [ ] 4.1 Run `bun run openspec:vision2 -- issues <change> --archive` against a fixture change and confirm the move + idempotency behavior.
- [ ] 4.2 Run `bun run openspec:vision2 -- check <change>` after archiving and confirm archived files are excluded from the open-issue count.
- [ ] 4.3 Run `bun run openspec:vision2 -- validate archive-vision2-closed-issues` for this change.
- [ ] 4.4 Run `bun run openspec:vision2 -- commit-check archive-vision2-closed-issues --phase close` before writing the closing overview.
- [ ] 4.5 Add unit tests to `scripts/openspec/vision2-driven.test.ts` covering BDD scenarios 2.1-2.8.

## 5. Close

- [ ] 5.1 Update `toc.md` footnote references if new spec files are added (none expected beyond `specs/vision2-issue-archive/spec.md`).
- [ ] 5.2 Close or resolve every active issue under `issues/*.md`.
- [ ] 5.3 Run `bun run openspec:vision2 -- check archive-vision2-closed-issues` to verify footnote coverage, issue convergence, and artifact presence.
- [ ] 5.4 If `check` reports open issues or orphan specs, iterate; otherwise archive with `openspec archive archive-vision2-closed-issues` and commit the archive result.
