## Scenario

- 10.4 Given two focused contexts, one chooses item injection and another chooses context injection in the same round
- 10.5 Given a failed AI-call path, staged attention does not falsely advance into a successful injection
- 10.6 Given error-first or interrupted stream boundaries, acceptance/snapshot bookkeeping follows the first-valid-stream-event law

## Commands

- `bun test packages/app-server/test/session-runtime.attention-system.test.ts --test-name-pattern "focused contexts with seeded snapshots|compact finished with active attention|first model stream fact is an error"`
- `bun test packages/app-server/test/model-client.delivery.test.ts --test-name-pattern "staged committed attention after a tool call|first provider attempt collapses before any usable reply"`

## Expected

- Per-context injection can mix `AttentionContext` and `AttentionItems` in one batch.
- Compact/context refresh does not replay historical items after the boundary.
- Error-first stream outcomes never become accepted.
- Retry after a collapsed first attempt preserves attempt history and stages the next attention payload explicitly.

## Actual

- The mixed-context test shows one focused context choosing item text while another chooses context text in the same collection batch.
- The compact-boundary test refreshes focused context projection without replaying historical items.
- The error-first delivery test records the first attempt as errored and never accepted.
- The ModelClient retry test shows a collapsed first attempt followed by accepted/completed receipts on retry, while staged committed attention is appended explicitly after tool output in the next request.

## Evidence

- Mixed injection and compact refresh:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2558)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2610)
- Error-first acceptance boundary:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:1317)
- Retry and staged continuation:
  - [model-client.delivery.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/model-client.delivery.test.ts:208)
  - [model-client.delivery.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/model-client.delivery.test.ts:252)

## Verdict

- pass
- Current-state injection, staged attention continuation, and acceptance bookkeeping all align with the first-valid-stream-event law and no longer depend on hidden recovery branches.
