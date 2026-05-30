# Vision-Driven Self Review

## Review State

- Change: `repair-terminal-system-git-attention-hook`
- Iteration: 1, reopened for Round 3 after manual `shell2` acceptance failed.
- Recurring issue counts: none.
- Exit-condition judgment: implementation exit is satisfied for the Round 3 fix; archive remains gated on operator acceptance.
- Next loop action: user manual re-test with daemon + `bun agenter shell2`; if accepted, archive the change.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| IDLE is the hook boundary | `RuntimeTerminalKernelAdapter.handleStatusChange()` still uses focused running `BUSY -> IDLE` as the action predicate. | Pass |
| IDLE is a window, not a one-shot check | After the immediate sealed HEAD/cursor comparison, the adapter registers a cancellable terminal commit waiter and reads when a later commit arrives while the terminal remains `IDLE`. | Pass |
| Leaving IDLE cancels stale work | A `BUSY` transition rejects the pending idle waiter and prevents stale attention commits. | Pass |
| Compare terminal truth against actor read cursor | `SessionRuntime` supplies sealed terminal head, actor cursor inspection, and a separate commit-wait hash boundary to avoid mixing git truth with runtime wait projections. | Pass |
| Reused shell2 bindings attach | Runtime startup normalizes already-focused TerminalSystem terminals through the same attach path used by explicit focus changes. | Pass |
| Trigger existing consuming read when unread | `commitIdleUnreadTerminal()` calls existing `readTerminalIngress()`, which routes to `readTerminalRepresentation(... remark: true)`. | Pass |
| Commit read result as wakeable terminal attention | The idle bridge promotes the read envelope to score `100`, `ingressType: "commit"`, and commits through host with `notifyLoop: true`. | Pass |
| Raw/live PTY path is covered | Adapter BDD covers later commits without `terminal_write`; session/runtime BDD covers already-focused control-plane terminal attach. | Pass |
| Preserve boundary cleanup | TerminalSystem still has no AttentionSystem/LoopBus import; no direct scheduler terminal branch was restored; `terminal_idle_ready` remains scheduler-only. | Pass |

## Deviations From Intent

1. None found for Round 3. The bridge still uses simple hash inequality (`HEAD !== readCursor`); ancestry checking remains unnecessary for the current linear terminal history.
2. `ManagedTerminal.waitCommitted()` currently waits on snapshot sequence semantics. `SessionRuntime` therefore passes a dedicated wait boundary via `getTerminalCommitWaitHash()` instead of feeding the sealed git read head into the waiter.

## New Questions For User

1. No blocking design question. The remaining product confirmation is empirical: re-run the daemon + `bun agenter shell2` path.

## Evidence

- HTML report: `review/self-review.html`
- Commands passed in this working context:
  - `bun test packages/app-server/test/runtime-terminal-kernel-adapter.test.ts`
  - `bun test packages/app-server/test/runtime-system-kernel-adapters.integration.test.ts`
  - `bun test packages/terminal-system/test/control-plane.test.ts --grep "cursor hash is inspected"`
  - `bun test packages/app-server/test/session-runtime.attention-system.test.ts --grep "focused terminal enters idle|already focused"`
  - `bun run --filter '@agenter/terminal-system' typecheck`
  - `git diff --check -- packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts packages/app-server/src/session-runtime.ts packages/app-server/test/runtime-terminal-kernel-adapter.test.ts packages/app-server/test/session-runtime.attention-system.test.ts openspec/changes/repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- check repair-terminal-system-git-attention-hook`
- Known external verification blocker:
  - `bun run --filter '@agenter/app-server' typecheck` currently fails in unrelated dirty CLI/app-kernel work: `packages/cli/src/trpc-server.ts` imports missing `PublicRoomActorPresentation` and `@agenter/message-system`.
- Unrelated dirty paths were left untouched:
  - `bun.lock`
  - `packages/app-server/src/app-kernel.ts`
  - `packages/cli/src/trpc-server.ts`
  - `packages/web-chat-view/**`
  - `openspec/changes/fix-web-chat-view-message-comment-polish/review/**`
- Task checkboxes updated by this working context:
  - Round 3 tasks `2.7` through `4.9`, plus review-state tracking `5.4`, were checked after implementation and verification.

## HTML Review Report

Created separately as `review/self-review.html`.

## Exit Handling

- Normal implementation exit is available after user acceptance.
- Archive is deferred because the last product-level signal was a manual failure report, and this round repaired the likely lifecycle gap that needs real daemon validation.
