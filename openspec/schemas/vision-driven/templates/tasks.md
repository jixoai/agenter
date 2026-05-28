## 1. Alignment / Investigation

- [ ] 1.1 Confirm the latest `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A.
- [ ] 1.2 Confirm any destructive migration / cleanup / state reset assumption with the user when it is not already explicitly approved.

## 2. BDD Contract

- [ ] 2.1 Scenario: Given the intent document defines the operator-visible effect When implementation is reviewed Then the behavior can be traced back to the intent and spec.
- [ ] 2.2 Add boundary-condition scenarios for the risky edges identified in the intent document and spec.

## 3. Implementation

- [ ] 3.1 Implement the smallest platform-law change or atom needed by the spec.
- [ ] 3.2 Implement any required migration / cleanup / reset helper that the approved breaking update needs.

## 4. Verification

- [ ] 4.1 Run targeted behavior tests.
- [ ] 4.2 Run `openspec validate <change> --type change --strict` for this change.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.html` comparing implementation against `plans/plan.md`.
- [ ] 5.2 If the review is entering a real loop, run `bun run openspec:vision -- review-state <change>` to persist iteration / recurrence state.
- [ ] 5.3 Run `bun run openspec:vision -- check <change>` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
