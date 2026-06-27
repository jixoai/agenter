# TOC

## Preface

This change adds an issue-archive operation to the vision2 controller so that closed or resolved issue files can be relocated from the active `issues/` folder into a sibling `issues/closed/` directory. The underlying drive is that vision2 uses issue `state` to drive the iteration-exit decision (open issues keep the loop going; all-closed allows exit), but closed files left in the active folder clutter the issue list and blur which problems are still being worked. Archiving gives the lifecycle a clean finish: closed findings move to `issues/closed/`, the active set stays sharp, and the archived evidence remains traceable. The final visible effect is that running `bun run openspec:vision2 -- issues <change> --archive` relocates every non-open issue, reports the moves, and is safely re-runnable; a subsequent `check` then naturally excludes those files from its open-issue count. The design preserves the read-only contract of `check` — archiving is an explicit operator action, never a side effect of validation.

One open design point (recorded as an issue, now resolved) is whether archiving should be a `--archive` flag on the existing `issues` command or a new top-level command; this change adopts the flag form as the default pending user confirmation.

## Guided Reading

1. `interview_plan.md` - the intent source of truth: the self-interview Q&A ledger, codebase evidence, and the decisions vs. assumptions split.
2. `specs/vision2-issue-archive/spec.md` - the durable contract for the archive operation (trigger, eligibility, destination, idempotency, read-only check).
3. `tasks.md` - the BDD-first execution checklist tracing back to the interview and spec.
4. `issues/001-cli-surface-shape.md` - the resolved issue on CLI command vs. flag shape, with the decision recorded.

## Footnote References

[^interview]: interview_plan.md
[^tasks]: tasks.md
[^archive]: specs/vision2-issue-archive/spec.md
[^issue1]: issues/001-cli-surface-shape.md
