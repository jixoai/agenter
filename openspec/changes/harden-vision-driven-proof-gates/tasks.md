## 1. BDD Contract

- [x] 1.1 Add a behavior test proving `check` accepts a free-form non-empty `review/self-review.html` file.
- [x] 1.2 Add a behavior test proving an invalid optional `review/state.json` still fails `check`.
- [x] 1.3 Add a behavior test proving `check` passes when the review HTML is free-form and any provided `review/state.json` is valid.

## 2. Workflow Law

- [x] 2.1 Update the durable workflow spec and change spec so self-review stays structured but free-form.
- [x] 2.2 Update the schema instructions and templates so `research/specs/tasks` are stronger while `self-review` stays loosely checked.
- [x] 2.3 Update `scripts/openspec/vision-driven.ts` so `check` validates artifact sanity without rigid HTML policing.

## 3. Workflow Exercise

- [x] 3.1 Run the focused BDD test file for the controller changes.
- [x] 3.2 Back up the plan, revise the intent after user feedback, and keep `plans/plan.md` as the SSOT.
- [x] 3.3 Produce a free-form `review/self-review.html`, run `bun run openspec:vision -- check harden-vision-driven-proof-gates`, and confirm it passes without rigid section rules.
- [x] 3.4 Run `openspec validate harden-vision-driven-proof-gates --type change --strict` and `openspec validate --specs --strict`.
