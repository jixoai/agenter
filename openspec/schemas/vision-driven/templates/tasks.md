## 1. BDD Contract

- [ ] 1.1 Scenario: Given the intent document defines the operator-visible effect When implementation is reviewed Then the behavior can be traced back to the intent and spec.

## 2. Implementation

- [ ] 2.1 Implement the smallest platform-law change or atom needed by the spec.

## 3. Verification

- [ ] 3.1 Run targeted behavior tests.
- [ ] 3.2 Run OpenSpec validation for this change.

## 4. Self-Review Loop

- [ ] 4.1 Generate `review/self-review.html` comparing implementation against `plans/plan.md`.
- [ ] 4.2 Run `bun run openspec:vision -- check <change>` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
