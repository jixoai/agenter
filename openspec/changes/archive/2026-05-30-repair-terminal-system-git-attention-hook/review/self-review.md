# Vision-Driven Self Review

## Review State

- Change: `repair-terminal-system-git-attention-hook`
- Iteration: 2, reopened for Round 5 after real daemon + `shell2` and BootstrapAdmin global terminal write acceptance still did not commit terminal attention.
- Recurring issue counts: none.
- Exit-condition judgment: implementation exit is satisfied for the Round 5 product/global fix; archive remains gated on operator acceptance.
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
| TerminalSystem truth chain is covered first | Control-plane BDD proves raw `inputBytes` advances `waitCommitted(...)`, can be sealed to git truth, consumes through `readAuthorized(... remark:true)`, advances the actor cursor, and appends no automation activity. | Pass |
| Already-IDLE focus hydration is covered | Adapter BDD proves focus sync arms an idle waiter without requiring a fresh `BUSY -> IDLE`; SessionRuntime BDD proves a shell2-style already-idle focused terminal promotes raw input into terminal attention. | Pass |
| BUSY race keeps the pre-busy wait baseline | Runtime adapter BDD now proves a waiter canceled by `BUSY` resumes from the pre-BUSY baseline when output commits before the next idle wait is registered. | Pass |
| Product terminal history is present | shell-next product bootstrap now requests `profile.gitLog: "normal"`, and daemon AppKernel global TerminalControlPlane defaults terminals to `gitLog: "normal"`. | Pass |
| Product/global write path is covered | AppKernel BDD creates a product-style global terminal, grants it to the avatar actor, focuses it into the runtime, writes through BootstrapAdmin `writeGlobalTerminal(...)`, and observes terminal attention plus attention signal advancement. | Pass |
| First unread read may be a snapshot | Runtime terminal ingestion now previews without consuming, requests diff mode for idle/drain paths, and accepts semantic snapshot lines when the physical bottom `tail` is blank. | Pass |
| Preserve boundary cleanup | TerminalSystem still has no AttentionSystem/LoopBus import; no direct scheduler terminal branch was restored; `terminal_idle_ready` remains scheduler-only. | Pass |

## Deviations From Intent

1. None found for Round 5. The bridge still uses simple hash inequality (`HEAD !== readCursor`); ancestry checking remains unnecessary for the current linear terminal history.
2. `ManagedTerminal.waitCommitted()` currently waits on snapshot sequence semantics. `SessionRuntime` therefore passes a dedicated wait boundary via `getTerminalCommitWaitHash()` and preserves that baseline across BUSY cancellation instead of feeding the sealed git read head into the waiter.
3. A first read from a null cursor can be represented as a snapshot, not a diff. The runtime now treats nonblank `snapshot.lines` as the semantic terminal tail only when the physical `tail` is blank; all-empty snapshots remain filtered.

## New Questions For User

1. No blocking design question. The remaining product confirmation is empirical: re-run the daemon + `bun agenter shell2` path.

## Evidence

- HTML report: `review/self-review.html`
- Commands passed in this working context:
  - `bun test packages/app-server/test/runtime-terminal-kernel-adapter.test.ts`
  - `bun test packages/app-server/test/runtime-system-kernel-adapters.integration.test.ts`
  - `bun test packages/terminal-system/test/control-plane.test.ts --grep "raw inputBytes When output changes while idle|cursor hash is inspected"`
  - `bun test packages/app-server/test/session-runtime.attention-system.test.ts --grep "already focused|raw inputBytes changes output|focused terminal enters idle"`
  - `bun run --filter '@agenter/terminal-system' typecheck`
  - `git diff --check -- packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts packages/app-server/src/session-runtime.ts packages/app-server/test/runtime-terminal-kernel-adapter.test.ts packages/app-server/test/session-runtime.attention-system.test.ts openspec/changes/repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- check repair-terminal-system-git-attention-hook`
- Round 5 commands passed in this working context:
  - `bun test extensions/shell-next/test/run-shell-next.test.ts --grep "git-backed history is requested"`
  - `bun test packages/app-server/test/app-kernel.test.ts --grep "BootstrapAdmin writes through TerminalSystem"`
  - `bun test packages/app-server/test/runtime-terminal-kernel-adapter.test.ts`
  - `bun test packages/app-server/test/session-runtime.attention-system.test.ts --grep "raw inputBytes changes output|focused terminal enters idle|already focused"`
  - `bun test packages/terminal-system/test/control-plane.test.ts --grep "raw inputBytes|cursor hash is inspected"`
  - `bun test packages/app-server/test/session-runtime.attention-system.test.ts --grep "focused terminal snapshot|focused terminal diff invalidation|terminal read representation"`
  - `bun run --filter '@agenter/terminal-system' typecheck`
  - `git diff --check -- extensions/shell-next/src/product/bootstrap.ts extensions/shell-next/test/run-shell-next.test.ts packages/app-server/src/app-kernel.ts packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts packages/app-server/src/session-runtime.ts packages/app-server/test/app-kernel.test.ts openspec/changes/repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`
  - `bun run openspec:vision -- check repair-terminal-system-git-attention-hook`
- Known external verification blockers:
  - `bun run --filter '@agenter/app-server' typecheck` now has no errors from this change, but still fails in unrelated workspace resolution: `packages/cli/src/trpc-server.ts` cannot resolve `@agenter/message-system`.
  - `bun run --filter 'agenter-ext-shell-next' typecheck` fails in unrelated message type drift (`senderActorId`, `readActorIds`, and missing `MessageControlPlaneEntry.superKey/createdBySystemId`).
- Unrelated dirty paths were left untouched:
  - `bun.lock`
- Task checkboxes updated by this working context:
  - Round 4 tasks `6.1` through `8.6` were checked after red/green implementation and verification.
  - Round 5 tasks `9.1` through `11.6` were checked after product/global red/green implementation and targeted verification, except archive remains intentionally unchecked until user acceptance.

## HTML Review Report

Created separately as `review/self-review.html`.

## Exit Handling

- Normal implementation exit is available after user acceptance.
- Archive is deferred because the last product-level signal was a manual failure report, and this round repaired the product/global path that needs real daemon validation.
