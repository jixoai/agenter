## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` plus the new manual failure report agree on one cause: raw/live terminal output can advance terminal git truth without creating `terminal_write` activity, so the bridge must run from `BUSY -> IDLE` and HEAD/cursor state.
- [x] 1.2 Confirm no destructive migration, cleanup, or state reset is needed; this change only adds adapter/control-plane inspection and does not rewrite terminal git history or attention history.
- [x] 1.3 Confirm each task checkbox is checked only after it is completed and verified in the current working context.

## 2. BDD Contract

- [x] 2.1 Add adapter BDD for `HEAD == read cursor` on `BUSY -> IDLE`: no read, no commit, no wake signal.
- [x] 2.2 Add adapter BDD for `HEAD > read cursor` on `BUSY -> IDLE`: one consuming read, one wakeable terminal attention commit, terminal dirty state consumed.
- [x] 2.3 Add adapter BDD proving the idle bridge does not require `markTerminalDirty()` or `terminal_write`, covering the raw/live PTY path.
- [x] 2.4 Add terminal-control-plane BDD for non-consuming actor read cursor hash inspection.
- [x] 2.5 Add session/runtime BDD that simulates a focused terminal entering `IDLE` after unread git output and verifies terminal attention is committed once.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check repair-terminal-system-git-attention-hook --phase apply` before product-code work starts and record the result.
- [x] 3.2 Add a terminal-control-plane cursor inspection method that authorizes read access, resolves the reader actor, and returns the current cursor hash without consuming output or appending activity.
- [x] 3.3 Extend `RuntimeTerminalKernelAdapter` with a focused idle unread predicate: compare terminal git HEAD with actor read cursor; when unread, read existing terminal ingress, promote it to a wakeable terminal fact, commit it through the host with `notifyLoop: true`, and clear queued dirty state.
- [x] 3.4 Wire `SessionRuntime` to provide terminal HEAD and actor cursor inspection to the adapter for both control-plane terminals and local fallback terminals.
- [x] 3.5 Keep `terminal_idle_ready` lifecycle wording scheduler-only and do not restore direct scheduler `waitCommitted(...)` wake semantics.
- [x] 3.6 Add concise intent comments at the idle bridge effect point so future edits do not collapse raw/live output back into `terminal_write` activity.
- [x] 3.7 Update only current-context completed task checkboxes after matching code and BDD evidence are in place.

## 4. Verification

- [x] 4.1 Run targeted adapter and terminal-control-plane tests.
- [x] 4.2 Run targeted session/runtime attention tests for terminal attention ingress.
- [x] 4.3 Run `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`.
- [x] 4.4 Run `git diff --check` for touched files.
- [x] 4.5 Run `bun run openspec:vision -- commit-check repair-terminal-system-git-attention-hook --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md` and the latest manual raw/live failure.
- [ ] 5.2 Generate separate `review/self-review.html` as structured evidence if the vision workflow requires it.
- [ ] 5.3 If the review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If the review enters a real loop, run `bun run openspec:vision -- review-state repair-terminal-system-git-attention-hook`.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff repair-terminal-system-git-attention-hook` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, archive the change and commit the archive result only after the implementation is accepted.
- [ ] 5.7 Run `bun run openspec:vision -- check repair-terminal-system-git-attention-hook` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
