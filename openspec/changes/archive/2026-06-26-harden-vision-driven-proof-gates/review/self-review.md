# Vision-Driven Self Review

## Review State

- Change: `harden-vision-driven-proof-gates`
- Iteration: 1 / 5
- Recurring issue counts: none
- Exit-condition judgment: pass once OpenSpec artifact files validate strictly, the Markdown review record exists as the macro thinking layer, and the HTML report remains free-form presentation evidence.
- Next loop action: validate the workflow, then keep this dual review model as the source rule.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Use a separate worktree to test the workflow on a real task. | `.worktree/vision-driven-schema-eval` was used during the original workflow evaluation. | Met |
| Keep checks loose enough that AI still has room to think. | The controller accepts free-form Markdown and HTML review layers without rigid section policing. | Met |
| Keep generated OpenSpec change files conformant. | The workflow teaches strict validation, keeps `tasks.md` checkbox-trackable, and preserves the plan backup law. | Met |

## Deviations From Intent

1. The previous iteration treated `review/self-review.html` as the self-review artifact itself. That collapsed the thinking record and the presentation report into one file, which was not the user's intent.

## New Questions For User

1. None for this correction. The user clarified the model directly: Markdown is the macro review/thinking layer; HTML is the separate structured evidence/report layer.

## Evidence

- HTML report: `review/self-review.html`
- Test command: `bun test scripts/openspec/vision-driven.test.ts`
- Change validation: `openspec validate harden-vision-driven-proof-gates --type change --strict`
- Specs validation: `openspec validate --specs --strict`

## Exit Handling

- Normal exit remains archive plus commit.
- Abnormal exit remains `HANDOFF.md` plus commit before returning to user discussion.
