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
- [x] 2.6 Add BDD for the IDLE timing boundary: stale pre-idle `getHeadHash()` must not suppress unread output when sealing produces a newer terminal head.
- [x] 2.7 Add adapter BDD proving an idle terminal waits for a later commit when the first sealed head equals the read cursor.
- [x] 2.8 Add adapter BDD proving a `BUSY` transition cancels an idle commit waiter without committing stale terminal attention.
- [x] 2.9 Add session/runtime BDD proving a pre-focused TerminalSystem terminal is attached when `SessionRuntime` starts, covering reused shell2 bindings.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check repair-terminal-system-git-attention-hook --phase apply` before product-code work starts and record the result.
- [x] 3.2 Add a terminal-control-plane cursor inspection method that authorizes read access, resolves the reader actor, and returns the current cursor hash without consuming output or appending activity.
- [x] 3.3 Extend `RuntimeTerminalKernelAdapter` with a focused idle unread predicate: compare terminal git HEAD with actor read cursor; when unread, read existing terminal ingress, promote it to a wakeable terminal fact, commit it through the host with `notifyLoop: true`, and clear queued dirty state.
- [x] 3.4 Wire `SessionRuntime` to provide terminal HEAD and actor cursor inspection to the adapter for both control-plane terminals and local fallback terminals.
- [x] 3.5 Keep `terminal_idle_ready` lifecycle wording scheduler-only and do not restore direct scheduler `waitCommitted(...)` wake semantics.
- [x] 3.6 Add concise intent comments at the idle bridge effect point so future edits do not collapse raw/live output back into `terminal_write` activity.
- [x] 3.7 Update only current-context completed task checkboxes after matching code and BDD evidence are in place.
- [x] 3.8 Ensure the idle bridge compares against a sealed terminal git head rather than a stale synchronous head.
- [x] 3.9 Add a cancellable idle-window terminal commit waiter in the runtime terminal adapter.
- [x] 3.10 Wire `SessionRuntime` to TerminalSystem `waitCommitted(...)` for control-plane terminals and local fallback terminals.
- [x] 3.11 Normalize focused TerminalSystem terminals through the attach path during runtime startup/focus hydration.

## 4. Verification

- [x] 4.1 Run targeted adapter and terminal-control-plane tests.
- [x] 4.2 Run targeted session/runtime attention tests for terminal attention ingress.
- [x] 4.3 Run `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`.
- [x] 4.4 Run `git diff --check` for touched files.
- [x] 4.5 Run `bun run openspec:vision -- commit-check repair-terminal-system-git-attention-hook --phase self-review` before writing final review evidence.
- [x] 4.6 Re-run targeted session/runtime attention tests after the sealed-head timing fix.
- [x] 4.7 Run targeted adapter tests for idle wait/cancel behavior.
- [x] 4.8 Run targeted session/runtime attention tests for reused focused terminal attach.
- [x] 4.9 Re-run `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook` and `bun run openspec:vision -- check repair-terminal-system-git-attention-hook`.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md` and the latest manual raw/live failure.
- [x] 5.2 Generate separate `review/self-review.html` as structured evidence if the vision workflow requires it.
- [x] 5.3 If the review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [x] 5.4 If the review enters a real loop, run `bun run openspec:vision -- review-state repair-terminal-system-git-attention-hook`.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff repair-terminal-system-git-attention-hook` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, archive the change and commit the archive result only after the implementation is accepted.
- [x] 5.7 Run `bun run openspec:vision -- check repair-terminal-system-git-attention-hook` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

## 6. Round 4 TerminalSystem-First BDD

- [ ] 6.1 Add TerminalSystem control-plane BDD proving raw transport `inputBytes` advances `waitCommitted(...)`, seals to a git `HEAD`, consumes through `readAuthorized(... remark:true)`, advances actor read cursor, and does not append automation `terminal_write` activity.
- [ ] 6.2 Add runtime adapter BDD proving an already-idle focused terminal can arm the same idle-window waiter without a fresh `BUSY -> IDLE`.
- [ ] 6.3 Add SessionRuntime + TerminalSystem BDD proving shell2-style already-idle focused terminal raw input is promoted to terminal attention.

## 7. Round 4 Implementation

- [ ] 7.1 Run the Round 4 BDD tests and capture the initial failing behavior before implementation.
- [ ] 7.2 Add the smallest runtime adapter API needed to arm idle waiters from focus/attach/status hydration.
- [ ] 7.3 Wire SessionRuntime focus/attach/status synchronization to arm already-idle focused terminal waiters.
- [ ] 7.4 Preserve TerminalSystem purity: no AttentionSystem/LoopBus imports and no raw input modeled as `terminal_write`.
- [ ] 7.5 Re-run targeted TerminalSystem, runtime adapter, and SessionRuntime tests.

## 8. Round 4 Verification

- [ ] 8.1 Run `bun run --filter '@agenter/terminal-system' typecheck`.
- [ ] 8.2 Run scoped `git diff --check` for touched files.
- [ ] 8.3 Run `bun run openspec:vision -- validate repair-terminal-system-git-attention-hook`.
- [ ] 8.4 Run `bun run openspec:vision -- check repair-terminal-system-git-attention-hook`.
- [ ] 8.5 Update self-review evidence with the Round 4 red/green result and keep archive gated on user shell2 acceptance.
