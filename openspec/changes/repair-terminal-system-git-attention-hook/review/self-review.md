# Vision-Driven Self Review

## Review State

- Change: `repair-terminal-system-git-attention-hook`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: normal implementation exit is satisfied; archive is intentionally deferred until operator acceptance.
- Next loop action: user manual re-test with `bun agenter shell2`; if accepted, archive the change.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| IDLE is the hook boundary | `RuntimeTerminalKernelAdapter.handleStatusChange()` now inspects focused running terminals only on `BUSY -> IDLE`. | Pass |
| Compare terminal git `HEAD` against actor read cursor | Adapter receives `getTerminalHeadHash()` and `getTerminalReadCursorHash()` from `SessionRuntime`; `TerminalControlPlane.getReadCursorHashAuthorized()` exposes non-consuming cursor inspection. | Pass |
| Trigger existing consuming read when unread | `commitIdleUnreadTerminal()` calls existing `readTerminalIngress()`, which routes to `readTerminalRepresentation(... remark: true)`. | Pass |
| Commit read result as wakeable terminal attention | The idle bridge promotes the read envelope to score `100`, `ingressType: "commit"`, and commits through host with `notifyLoop: true`. | Pass |
| Raw/live PTY path is covered | Adapter BDD proves `BUSY -> IDLE` with `HEAD` ahead reads without `markTerminalDirty()` or `terminal_write`; session BDD simulates raw output line. | Pass |
| Preserve boundary cleanup | TerminalSystem still has no AttentionSystem/LoopBus import; no direct scheduler `waitCommitted(...)` path was restored; `terminal_idle_ready` remains scheduler-only. | Pass |

## Deviations From Intent

1. None found. The implementation uses simple hash inequality (`HEAD !== readCursor`) as planned; ancestry checking remains unnecessary for the current linear terminal git log.

## New Questions For User

1. No blocking question. The only product confirmation is empirical: the user should re-run the daemon + `bun agenter shell2` manual path.

## Evidence

- HTML report: `review/self-review.html`
- Commands:
  - `bun test packages/app-server/test/runtime-terminal-kernel-adapter.test.ts` passed.
  - `bun test packages/terminal-system/test/control-plane.test.ts --grep "cursor hash is inspected"` passed.
  - `bun test packages/app-server/test/session-runtime.attention-system.test.ts --grep "focused terminal enters idle with unread git head"` passed.
  - `bun test packages/app-server/test/runtime-system-kernel-adapters.integration.test.ts` passed.
  - `bun run --filter '@agenter/app-server' typecheck` passed.
  - `bun run --filter '@agenter/terminal-system' typecheck` passed after tightening the cursor-inspection test expectation.
  - `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook` passed.
  - `git diff --check` over touched files passed.
- Git commits reviewed:
  - `7e3f5890 docs(spec): define terminal idle git attention bridge`
  - `75ad3f04 fix(runtime): promote idle terminal git facts`
- Uncommitted paths:
  - This change has only self-review artifacts pending at review time.
  - The worktree also contains unrelated staged/modified `fix-studio-web-chat-view-embedding-style`, `studio`, `cli`, and `web-chat-view` paths; they were not touched or committed by this change.
- Task checkboxes updated by this working context:
  - `1.1` through `4.5` were checked after implementation and verification.

## HTML Review Report

Created separately as `review/self-review.html`.

## Exit Handling

- Normal exit is available after user acceptance.
- Archive is deferred because the latest user request is a failing manual test report, so the next practical gate is manual re-test rather than immediate archive.
