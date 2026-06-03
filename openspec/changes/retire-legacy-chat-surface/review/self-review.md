# Vision-Driven Self Review

## Review State

- Change: `retire-legacy-chat-surface`
- Iteration: `1 / 5`
- Recurring issue counts: `apply-phase commit-check skipped before implementation = 1`
- Exit-condition judgment: The implementation now matches the one-cut removal intent on product behavior and naming. This review round is sufficient for self-review and commit preparation, but not yet for archive because no clean change-local commit exists yet.
- Next loop action: run `commit-check --phase self-review`, record the result, and produce the clean implementation commit before any archive decision.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Session truth must not carry a built-in room field. | `packages/app-server/src/session-doc.ts`, `packages/app-server/src/session-store.ts`, `packages/app-server/src/session-catalog.ts`, `packages/app-server/src/app-kernel.ts`, plus `packages/app-server/test/app-kernel.test.ts` now asserting `session.json` and runtime session objects never gain `primaryRoomId` through create/start/stop/restart. | Aligned |
| Visible room sends must require an explicit room, unless the reply is already anchored by message-origin source facts. | `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/app-kernel.ts`, `packages/client-sdk/src/runtime-store.ts`, `packages/tui/src/run-tui.ts`, `packages/app-server/test/session-runtime.attention-system.test.ts`, `packages/app-server/test/app-kernel.test.ts`, `packages/client-sdk/test/runtime-store.test.ts`. | Aligned |
| There is no protected-room concept. | `apps/shell/src/app-runtime/lifecycle-reaction.ts` now archives by explicit room state only; `packages/app-server/test/app-kernel.test.ts` archives/deletes ordinary rooms and verifies explicit archived/deleted/unknown room failures instead of fallback behavior. | Aligned |
| `chat.*` is not a truth-facing public surface. | `packages/app-server/src/trpc/router.ts` moved transcript/cycle reads to `runtime.messagesPage` and `runtime.cyclesPage`; `packages/client-sdk/src/types.ts` and `packages/client-sdk/src/runtime-store.ts` follow the new public surface. | Aligned |
| File truth must be named clearly in the code. | Added or preserved file-truth comments in `packages/client-sdk/src/runtime-store.ts`, `apps/shell/src/app-runtime/lifecycle-reaction.ts`, and `packages/app-server/src/app-kernel.ts`. | Aligned |
| Test and harness language should stop implying a session-owned primary room. | `packages/app-server/test-support/*`, `packages/app-server/test/*`, and `apps/shell-old/legacy/terminal2/test-support/real-cli-shell-semantic-suite.ts` now use explicit room or attached-room wording instead of `primaryRoom*` names. | Aligned |

## Deviations From Intent

1. Task `3.1` was not honored in sequence. The implementation work began before `bun run openspec:vision -- commit-check retire-legacy-chat-surface --phase apply` and before a clean artifact-only commit existed. This is a workflow deviation, not a product-law deviation.
2. The last cleanup pass changed test naming plus two narrow non-runtime residues (`apps/shell` protected-room helper and client projection fallback). After that pass, I reran targeted app-server/client checks, but I did not rerun every gated real-provider scenario (`real-note-system`, `real-message-query`, `real-room-terminal-cold-restart`). Earlier in the same apply round, real LoopBus evidence had already passed, and the final cleanup did not change backend routing law.

## New Questions For User

1. None in this round.

## Evidence

- HTML report: `review/self-review.html`
- Command / log evidence:
  - `bun run openspec:vision -- commit-check retire-legacy-chat-surface --phase self-review` -> `ok: true`, latest OpenSpec commit `c0924d40`, suggested next commit `docs(spec): record retire-legacy-chat-surface self-review`
  - `bun test packages/app-server/test/app-kernel.test.ts -t 'without any attached room|explicit room terminal and workspace authorities|global room authority'`
  - `bun test packages/app-server/test/mock-loopbus.room-relay.integration.test.ts packages/app-server/test/mock-loopbus.room-relay-compact.integration.test.ts packages/app-server/test/mock-loopbus.settled-follow-up.integration.test.ts packages/app-server/test/mock-loopbus.message-query.integration.test.ts packages/app-server/test/heartbeat-invocation-ledger.integration.test.ts`
  - `bun test packages/client-sdk/test/runtime-store.test.ts -t 'projection message without room identity|explicit focused room|missing-room error|uploaded session assets'`
  - `bun run --filter '@agenter/app-server' verify:workspace-attention`
  - `bun run --filter '@agenter/app-server' typecheck`
  - `bun run --filter 'agenter-app-shell' typecheck`
  - `bun run openspec:vision -- validate retire-legacy-chat-surface`
  - Earlier in the same apply round: `AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-loopbus.integration.test.ts -t 'asks the assistant to ask gaubee about lunch'`
- Key implementation files reviewed:
  - `packages/app-server/src/app-kernel.ts`
  - `packages/app-server/src/session-doc.ts`
  - `packages/app-server/src/session-store.ts`
  - `packages/app-server/src/session-catalog.ts`
  - `packages/app-server/src/session-runtime.ts`
  - `packages/app-server/src/trpc/router.ts`
  - `packages/client-sdk/src/runtime-store.ts`
  - `packages/client-sdk/src/types.ts`
  - `apps/shell/src/app-runtime/lifecycle-reaction.ts`
  - `apps/shell-old/legacy/terminal2/test-support/real-cli-shell-semantic-suite.ts`
- Git commits reviewed:
  - Base context commit from the prior prompt-authority round: `18065e15`
  - Change-local commit for `retire-legacy-chat-surface`: not created yet in this working tree
- Uncommitted paths, if any:
  - `packages/app-server/src/*`, `packages/app-server/test*`, `packages/client-sdk/src/*`, `packages/client-sdk/test/*`, `packages/tui/src/run-tui.ts`
  - `apps/shell/src/app-runtime/lifecycle-reaction.ts`
  - `apps/shell-old/legacy/terminal2/test*`
  - `openspec/changes/retire-legacy-chat-surface/tasks.md`
  - `openspec/changes/retire-legacy-chat-surface/review/self-review.md`
  - `openspec/changes/retire-legacy-chat-surface/review/self-review.html`
- Self-review gate result:
  - `commit-check --phase self-review` returned `ok: true`
  - `changePaths`: `tasks.md`, `review/self-review.md`, `review/self-review.html`
  - `otherPaths`: implementation files remain intentionally dirty until the clean change-local commit
- Task checkboxes updated by this working context:
  - `1.1`, `1.2`, `1.4`
  - `2.1` through `2.8`
  - `3.2` through `3.10`
  - `4.1` through `4.4`
  - `5.1`, `5.2`

## HTML Review Report

Created at `review/self-review.html` as the structured evidence surface for commands, files, deviations, and current git state.

## Exit Handling

- Normal exit is deferred until the self-review commit-check result is recorded and the change has a clean implementation commit.
- Abnormal exit is not active. No handoff or review-state persistence is needed in this round.
- Archive is intentionally deferred. The user asked for task/review/commit closure first, not archive.
