# Intent Document

## Current Round

- Round: 5
- Status: Round 5 app/global path repaired and validated by targeted BDD; archive remains gated on real daemon + shell2 acceptance
- Previous plan backup: `plans/plan-v3.md`

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 下一个问题，开始往底层深入，是关于terminalSystem的问题：
> 底层最初的设计，terminalSystem使用attentionSystem的API做开发的时候，是有一个明确的需求：终端的变化需要通过debounce+throttle自动抓取快照的，在terminalSystem中，就是形成git-commit（我们使用git技术来存储terminal的变更信息，使用git技术来提供查询能力）
> 进一步，基于git技术，定位最后一次阅读的git-commit-hash。
> 从而形成一种工作方式：如果LoopBus在工作中，那么当然是AI自己使用terminal-cli工具自己去查询，而一旦停下来，terminalSystem收到这个hook，那么就会尺寸检查目前的git-log，是否有新的提交（意味着终端发生了变更），从而转化成commit-attention-item的动作，进一步激发AI的LoopBus，让AI继续工作。
>
>
> 使用openspec vision开始驱动工作

> 不要想复杂了，这里就一件非常简单的事情，其它事情都是已经存在的正交功能。
> 这件简单的事情就是：如果terminal的git HEAD HASH 比目前 readed HASH 更超前。那么就触发自动read，将read的结果作为 attentionItem进行commit。
>
> 这个事情之前已经让AI开发过，我不知道为什么这个功能丢了。
>
> 你要证明你理解我说的话。

> 最后补充一下：“在已有 hook 触发时”，这里就是意味着进入idle 的时候触发。
>
> 然后我在问一下（我建议你调查一下），之前我命名让AI开发过这个功能，怎么就没了？你如果找不到相关的证据也不勉强。我之所以这样问，是担心代码中存在架构残留，需要我们一起整顿的。
>
> 如果没找到就意味着架构可能是比较干净的，你直接做这个新功能就行了。

> 经过我测试，并不符合预期，我在终端中通过在终端输入内容，理论上应该经历了1.2.3.4.5 了才对，但是终端一直处于idle状态。
>
> 除非你6这里有问题，这里的伪代码应该是：
> `onIdle({signal}) { await terminal.waitUnread({signal}); signal.postTask(async()=>{ commitAttentionItem(await terminal.read()) }) }`
>
> 所以我怀疑你的代码是：
> `onIdle(){ if(await terminal.hasUnread()){ commitAttentionItem(await terminal.read()) } }`
>
> 调查一下，是不是我说的这样

> 测试的关键应该聚焦在terminalSystem自身上，先确保terminalSystem的每个关键点都有对应的测试，并且能再集成起来也通过测试，最后才是 整体的 LoopBus+terminalSystem 的整合测试，也就是你说的这些。
>
> 先用测试复现问题，然后再解决问题，仍然使用openspec vision驱动

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Terminal changes must be debounced/throttled into git commits; the system uses git to store/query terminal changes and tracks the last-read git commit hash. | Reuse existing terminal git and cursor primitives. |
| 2 | User | The task is simple: if terminal git HEAD HASH is ahead of current readed HASH, trigger automatic read, and commit the read result as an attention item. | The implementation must be a small bridge, not a scheduler redesign. |
| 3 | User | "Existing hook" means when terminal enters `IDLE`. | The hook is terminal BUSY -> IDLE, not generic LoopBus pause/stop. |
| 3 | User | Investigate whether a previous implementation existed and whether residual architecture needs cleanup. | Perform git/OpenSpec archaeology before implementation. |
| 4 | User | Manual shell2 acceptance failed; the current code appears to be a one-shot `hasUnread()` check rather than an idle-scoped `waitUnread({ signal })`. | Reopen implementation. The idle hook must keep a cancellable unread wait alive while the terminal remains idle. |
| 5 | User | Testing must focus on TerminalSystem itself first, then TerminalSystem integration, and only then LoopBus + TerminalSystem integration. | Reopen testing plan. Reproduce the bug from the TerminalSystem truth chain before fixing runtime/app integration. |
| 6 | User | Real daemon + shell2 manual input still leaves LoopBus idle, and BootstrapAdmin `terminal write "!"` also leaves LoopBus idle; therefore the prior tests are wrong. | Reopen Round 5. Add tests for the real app/global path, not only hand-built TerminalSystem fixtures. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/terminal-system/src/committer.ts` | `Committer` already provides debounce/throttle and `forceCommit()`. | Do not rebuild snapshot timing. |
| `packages/terminal-system/src/agentic-terminal.ts` | `status-idle` commits are created on BUSY -> IDLE, and `getHeadHash()`, `waitCommitted()`, `markDirty()`, `sliceDirty()` exist. | The IDLE hook can rely on existing terminal git HEAD truth. |
| `packages/terminal-system/src/terminal-db.ts` | `terminal_read_cursor` stores `(terminal_id, reader_actor_id, cursor_hash)`. | `readed HASH` is already modeled as actor-scoped cursor state. |
| `packages/terminal-system/src/terminal-control-plane.ts` | `readAuthorized({ remark: true })` reads from the actor cursor and commits the cursor to the returned `toHash`. | Auto-read can use the existing consuming read path. |
| `packages/terminal-system/test/control-plane.test.ts` | Existing raw `inputBytes` transport tests prove bytes reach the PTY and do not create activity truth, but they do not assert `waitCommitted`, `sealIdleCommit`, git head, and read cursor as one contract. | TerminalSystem tests need a stronger integrated raw-output truth scenario. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | Current `handleStatusChange()` only emits a terminal actionable signal for some IDLE transitions; it does not compare HEAD vs read cursor or auto-read. | This is the missing bridge location. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | The current repaired bridge still checks HEAD/cursor only once on `BUSY -> IDLE`; it does not register a terminal commit waiter for the idle window. | This explains the user's pseudocode concern. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | The Round 3 waiter starts only after `handleStatusChange(previousStatus: BUSY, status: IDLE)`. It is not armed merely because a focused terminal is already `IDLE`. | This likely explains the latest shell2 screenshot: raw input can update an already-idle terminal without producing a new BUSY -> IDLE transition. |
| `packages/app-server/src/session-runtime.ts` | `buildTerminalSystemIngressEnvelope()` already turns `readTerminalRepresentation(... remark:true)` into a terminal world-fact attention envelope. | The read-result-to-attention path exists; it needs to be invoked at the IDLE hash comparison boundary. |
| `packages/app-server/src/session-runtime.ts` | Runtime startup assigned `focusedTerminalIds` from TerminalControlPlane directly; focused terminals that already existed before runtime start were not normalized/attached. | App-bound shell2 reuse can miss `terminal.onStatus()` and therefore never reach the adapter idle hook. |
| `apps/shell-next/src/app/bootstrap.ts` | The shell-next app terminal binding did not request `profile.gitLog: "normal"`, while prior tests used hand-built terminals that did. | App bindings could create terminals without git-backed history, so `HEAD > read cursor` had no durable read source. |
| `packages/app-server/src/app-kernel.ts` | The daemon global `TerminalControlPlane` was created without a git-log default. | Other app/global terminal creation paths needed the same git-backed default instead of relying only on shell-next local profile wiring. |
| `packages/app-server/src/session-runtime.ts` | The idle bridge now requests a diff read, but TerminalSystem legitimately returns a snapshot for an actor with no previous read cursor. The old runtime meaningful filter only inspected physical bottom `tail`, which can be blank while visible output exists near the top of the screen. | First unread terminal facts could be dropped before consuming read/cursor advancement, leaving LoopBus idle even though TerminalSystem had a newer git head. |
| `packages/terminal-system/src/managed-terminal.ts` | `ManagedTerminal.getHeadHash()` returns snapshot `seq`, while git-log reads/cursors are only committed when `profile.gitLog` is enabled. | This is a projection-vs-git-truth residual; the new fix must not deepen that leak. |
| `openspec/changes/archive/2026-05-05-decouple-terminal-activity-from-runtime-loop/design.md` | The old runtime had two terminal wake paths: `markTerminalDirty -> notifyInput("terminal")` and scheduler `waitCommitted(...)`; that change intentionally separated physical terminal changes from runtime ingress. | This explains why broad terminal wake behavior was removed. |
| `openspec/changes/archive/2026-05-05-decouple-terminal-activity-from-runtime-loop/specs/runtime-terminal-activity-bridge/spec.md` | The bridge may upgrade terminal changes to actionable ingress when an explicit action predicate matches. | `HEAD > readed HASH on IDLE` should be added as a named explicit action predicate. |
| Commit `208e6948 fix(runtime): purify room and terminal attention boundaries` | Removed high-score `terminal_idle_ready` attention task text and made idle-ready scheduler-only. | Evidence that an older idle-triggered attention behavior existed but was intentionally removed because it was too semantic/noisy. |
| Commit `3b2576fb refactor: gate terminal wakes through runtime activity bridge` | Removed direct scheduler `terminal.waitCommitted({ fromHash: terminal.getHeadHash() })` handles and removed direct `hasFocusedDirtyWork()` ready-now checks from wait logic. | Evidence that low-level terminal commit wake plumbing existed and was later collapsed into bridge semantics. |
| Commit `85993785 feat(terminal): scope read cursors by actor` | Added actor-scoped terminal read cursors and changed runtime terminal reads to consuming `remark:true`. | Evidence that the correct "readed HASH" primitive exists after the old broad wake behavior was removed. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not yet committed; plan is still being revised. |
| Task-progress commits | Commit containing task checkbox updates plus matching code/BDD evidence | Not started. |
| Self-review updates | Commit containing review output and reopened tasks before next apply loop | Not started. |
| Normal archive | Commit containing archive result | Not started. |
| Abnormal handoff | Commit containing handoff evidence before returning to user discussion | Not required yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/runtime-system-kernel-adapters/spec.md` | Terminal observation and ingress promotion are distinct; bridge owns wake decisions. | Extend with one explicit action predicate. |
| `openspec/specs/terminal-control-plane/spec.md` | Focused terminal observations default to passive history unless explicitly actionable; read cursors are actor-scoped. | Extend with `HEAD > read cursor` on IDLE as actionable. |
| `openspec/specs/runtime-terminal-contract/spec.md` | Runtime terminal reads expose representation and cursor metadata. | Reuse for auto-read attention content. |
| `openspec/changes/archive/2026-05-05-decouple-terminal-activity-from-runtime-loop/*` | Broad terminal dirty/wait wake was intentionally removed; bridge actionability became the law. | Reuse. The new feature should be a precise bridge predicate, not rollback. |
| `openspec/changes/archive/2026-05-05-purify-runtime-system-boundaries/*` | `terminal_idle_ready` must not become a model-visible "ready for input" task phrase. | Preserve. Auto-read commits actual terminal diff/snapshot content, not lifecycle wording. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| "不要想复杂了" | Do not expand into broad scheduler architecture. | Add the missing predicate and bridge call only. |
| "terminal的git HEAD HASH 比目前 readed HASH 更超前" | There is unread terminal git history for the current reader actor. | Compare current terminal HEAD with actor-scoped read cursor hash. |
| "触发自动read" | Use existing terminal read flow, not raw git parsing. | Call consuming terminal read with `remark:true`. |
| "read的结果作为 attentionItem进行commit" | The read payload becomes a committed attention item. | Use existing runtime terminal ingress/attention commit path. |
| "进入idle 的时候触发" | BUSY -> IDLE is the hook boundary. | Hook from terminal status transition after status-idle commit is available. |
| "测试的关键应该聚焦在terminalSystem自身上" | Prove TerminalSystem truth before runtime/LoopBus behavior. | Start with raw transport -> waitCommitted -> seal/read cursor tests. |
| "先用测试复现问题，然后再解决问题" | Red test must represent the observed shell2 failure before code changes. | Add failing already-IDLE focused terminal integration before implementation. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None | Git/OpenSpec archaeology was enough. | No spike required. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should the predicate inspect only focused terminals? | Existing bridge law treats focus as eligibility. | Yes, only current actor focused terminals auto-read. |
| Should the auto-read attention item be scored as actionable? | "激发AI的LoopBus" requires a wakeable attention item. | Yes, but the content is the terminal read result, not `terminal_idle_ready` task text. |

## Intent

### Surface Intent

在 terminal 进入 `IDLE` 时，检查该 terminal 当前 git `HEAD` 是否比当前 reader actor 的 `readed HASH` 更新。如果更新，调用已有 terminal read，推进 read cursor，并把 read 结果 commit 成 attention item，从而让 LoopBus 继续工作。

Round 3 correction: entering `IDLE` is not only a momentary if-check. While the terminal remains idle, the runtime bridge must keep a cancellable unread/commit wait alive so a delayed status-idle git commit can still trigger the same consuming read and attention commit.

Round 4 correction: tests must first prove the TerminalSystem truth chain. The app failure is likely not that raw `inputBytes` differs from manual input; it is that a focused terminal may already be `IDLE`, and raw output can advance TerminalSystem commits without a fresh `BUSY -> IDLE` transition to arm the runtime waiter.

Round 5 correction: the previous BDD still overfit hand-built terminals. It manually enabled `profile.gitLog: "normal"` and asserted internal attention commits, but did not prove the actual shell-next/app binding path: shell-next creates a global terminal, focuses it into the avatar runtime, the user or BootstrapAdmin writes through the shared global TerminalControlPlane, and the runtime must convert the resulting unread terminal truth into wakeable attention. The new red tests must pin that app/global path before any production fix.

Round 5 finding: the app/global path had two real gaps. First, app-bound global terminals did not consistently request git-backed history. Second, a first unread read for an actor with no read cursor can return a snapshot rather than a diff; if terminal output is above the bottom viewport rows, the snapshot's physical `tail` can be blank even though `snapshot.lines` contains the terminal fact. Runtime attention ingestion must treat that snapshot semantic tail as meaningful before it performs the consuming read.

### Underlying Drive

恢复 terminalSystem 原先的闭环：终端本体变化由 git 记录；read cursor 表达 AI 上次真正读到哪里；IDLE 表达终端本轮输出稳定；如果稳定后的 HEAD 超过 read cursor，说明有新事实需要进入 attention。

### Final Visible Effect

AI 执行一个终端任务后，终端输出在结束/稳定到 IDLE 时会自动被读入 attention。用户不需要额外提醒 AI "你看一下终端"。如果 HEAD 没有超过 readed hash，则不会重复读、不会重复提交 attention item。

## Platform Diagnosis

- Current platform laws:
  - TerminalSystem owns git commits, status-idle commits, head hash, and actor-scoped read cursors.
  - TerminalSystem owns raw transport input and must expose terminal truth advancement without modeling raw input as automation activity.
  - Runtime bridge owns whether terminal facts become attention ingress.
  - AttentionSystem owns attention item commit and wakeable score semantics.
- Does this fit as a regular atom:
  - Yes. This is a missing bridge predicate between existing atoms.
- Does this require law upgrade:
  - Small law extension only: terminal IDLE bridge predicate `headHash > readCursorHash`, and focused already-idle terminals must have the same idle-window wait as a fresh `BUSY -> IDLE`.
- Breaking update stance:
  - Do not resurrect old broad terminal dirty wake behavior.
  - Do not resurrect `terminal_idle_ready` as model-visible task text.
- User confirmations still required:
  - Only whether focused-terminal eligibility is enough; current default is yes.

## Reverse-Inferred Design

### Interaction / Visual Story

1. Terminal receives raw transport bytes and produces output.
2. TerminalSystem debounces/throttles output into snapshot/git truth and resolves commit waiters.
3. The terminal may either move `BUSY -> IDLE` or remain already `IDLE`.
4. Runtime terminal bridge keeps an idle-window wait active for focused running idle terminals.
5. Runtime terminal bridge reads:
   - current terminal git `HEAD`,
   - current actor read cursor hash.
6. If `HEAD` is not ahead of read cursor, no-op and keep waiting while idle.
7. If `HEAD` is ahead, runtime performs existing consuming terminal read.
8. The read result is committed as a terminal attention item.
9. The reader cursor is advanced to the read result's `toHash`.

### Interface Shape

- Add a terminal bridge method or adapter path with app semantics:
  - `observeIdleTerminal(terminalId)` / `syncIdleTerminalWaits()`
  - input: terminal id from BUSY -> IDLE transition, focus hydration, attach, or status synchronization
  - condition: focused/running/actionable + `headHash !== readCursorHash`
  - action: `readTerminalIngress(terminalId)` using existing `remark:true` path, then commit attention.
- Add or expose a read cursor lookup if the adapter cannot currently obtain `readed HASH` without doing a consuming read first.
- Keep read result formatting through `buildTerminalSystemIngressEnvelope(...)`.

### Data Shape

- Durable fact: terminal git HEAD.
- Durable lower-level wait boundary: terminal snapshot sequence for `waitCommitted(...)`.
- Durable reader projection: actor-scoped read cursor hash.
- Derived predicate: `terminalHeadHash` is ahead of `readCursorHash`.
- Effect: one consuming terminal read and one attention commit for that read payload.

### Architecture Shape

- TerminalSystem stays pure:
  - no attention imports,
  - no LoopBus imports,
  - no model semantics.
- Runtime terminal adapter/bridge owns the comparison and actionability.
- SessionRuntime supplies existing dependencies:
  - focused terminal set,
  - terminal running/status state,
  - read terminal ingress,
  - attention commit host.
- AttentionSystem only receives a normal committed terminal item.
- Runtime startup/focus hydration must attach already-focused TerminalSystem terminals before relying on status hooks.
- Runtime focus/status hydration must arm the idle-window waiter when the terminal is already focused, running, actionable, and `IDLE`; the waiter must not depend exclusively on seeing a future `BUSY -> IDLE`.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Focus eligibility | Auto-reading every terminal can create unrelated work. | Only current actor focused terminals. |
| Commit score | Wakeable item likely needs positive score. | Use existing action-item semantics for this auto-read path, not passive score 0. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 1.1 Investigate prior implementation / removal evidence.
- [x] 1.2 Investigate manual shell2 failure and one-shot idle suspicion.
- [x] 2. Update specs from Round 3 intent.
  - Add terminal idle-window wait predicate: on IDLE, keep a cancellable wait for unread terminal commit while status remains IDLE.
  - Add runtime startup/focus hydration requirement: already-focused TerminalSystem terminals must be attached.
  - Preserve passive observation and scheduler-only `terminal_idle_ready` wording laws.
- [x] 3. Write BDD tasks from specs.
  - Adapter/unit: HEAD equals read cursor at IDLE, then a later commit resolves the idle waiter and commits attention.
  - Adapter/unit: BUSY cancels an idle waiter without committing stale attention.
  - Session/runtime: a pre-focused control-plane terminal is attached during runtime start/focus hydration.
- [x] 4. Implement tasks.
  - Add a cancellable terminal commit waiter at the adapter idle boundary.
  - Wire SessionRuntime to TerminalControlPlane `waitCommitted(...)` without importing AttentionSystem into TerminalSystem.
  - Normalize focused terminals during runtime startup so reused shell2 bindings attach.
  - Keep old broad scheduler terminal wake behavior removed.
- [x] 5. Self-review against intent and decide whether to loop.
- [x] 6. Round 4 terminalSystem-first testing.
  - Add TerminalSystem control-plane BDD: raw transport `inputBytes` advances `waitCommitted(...)`, can be sealed into a git head, and consuming `readAuthorized(... remark:true)` advances the actor read cursor without creating `terminal_write` activity.
  - Add Runtime adapter BDD: already-idle focused terminal arms an idle-window waiter without requiring `BUSY -> IDLE`.
  - Add SessionRuntime + TerminalSystem BDD: shell2-style already-idle focused terminal receives raw transport input and commits terminal attention through the existing read path.
- [x] 7. Round 4 implementation.
  - Add the smallest runtime adapter API needed to arm idle waits from focus/attach/status hydration.
  - Keep TerminalSystem pure; do not import AttentionSystem or LoopBus.
  - Keep raw transport separated from automation activity.
- [x] 8. Round 4 self-review and app acceptance gate.
- [x] 9. Round 5 app/global red tests.
  - Add shell-next app bootstrap BDD proving the terminal binding requests git-backed history.
  - Add AppKernel/SessionRuntime BDD proving a app-style focused global terminal written through `writeGlobalTerminal(...)` commits terminal attention and advances the attention signal.
  - Record the red failures: shell-next binding omitted `profile.gitLog`, and the app/global runtime path did not produce terminal attention.
- [x] 10. Round 5 implementation.
  - Default daemon global TerminalControlPlane terminals to `gitLog: "normal"`.
  - Request `gitLog: "normal"` from the shell-next app binding.
  - Make runtime terminal attention ingestion use diff reads with a non-consuming preview, and treat snapshot lines as semantic tail when the physical bottom tail is blank.
- [ ] 11. Round 5 verification and app acceptance gate.
  - Targeted BDD and low-level regressions pass in this working context.
  - Archive remains gated on user validation in the real daemon + `bun agenter shell2` path.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should non-focused terminals auto-read on IDLE? | Could wake AI from unrelated shared terminal noise. | No. |
| Should the read cursor comparison use ancestry or simple inequality? | Git history should normally be linear, but ancestry is more precise. | Use simple inequality for the current linear terminal log; null cursor means unread, equal means no-op. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Restore old `terminal_idle_ready` high-score task text. | It was intentionally removed because it created lifecycle obligation text instead of terminal facts. |
| Restore scheduler direct `waitCommitted(...)` wake path. | It was intentionally removed to avoid duplicate terminal wake semantics. |
| Treat all terminal dirty marks as attention. | Too broad; user asked for HEAD vs readed hash at IDLE. |
| Rebuild terminal git/cursor storage. | Existing orthogonal features already provide it. |

## Exit Conditions

- Default max review iterations: 3
- Issue recurrence threshold: 2 materially similar self-review failures require revising the Intent Document before more code.
- Custom exit condition from intent: On terminal BUSY -> IDLE, if current terminal git HEAD is ahead of the current actor's read cursor, the runtime performs one consuming terminal read and commits that read result as one wakeable terminal attention item. If HEAD is unchanged, the hook is a no-op.
