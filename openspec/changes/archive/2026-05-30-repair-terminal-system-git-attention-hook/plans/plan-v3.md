# Intent Document

## Current Round

- Round: 3
- Status: research-plan revised after manual shell2 acceptance failure
- Previous plan backup: `plans/plan-v2.md`

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

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Terminal changes must be debounced/throttled into git commits; the system uses git to store/query terminal changes and tracks the last-read git commit hash. | Reuse existing terminal git and cursor primitives. |
| 2 | User | The task is simple: if terminal git HEAD HASH is ahead of current readed HASH, trigger automatic read, and commit the read result as an attention item. | The implementation must be a small bridge, not a scheduler redesign. |
| 3 | User | "Existing hook" means when terminal enters `IDLE`. | The hook is terminal BUSY -> IDLE, not generic LoopBus pause/stop. |
| 3 | User | Investigate whether a previous implementation existed and whether residual architecture needs cleanup. | Perform git/OpenSpec archaeology before implementation. |
| 4 | User | Manual shell2 acceptance failed; the current code appears to be a one-shot `hasUnread()` check rather than an idle-scoped `waitUnread({ signal })`. | Reopen implementation. The idle hook must keep a cancellable unread wait alive while the terminal remains idle. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/terminal-system/src/committer.ts` | `Committer` already provides debounce/throttle and `forceCommit()`. | Do not rebuild snapshot timing. |
| `packages/terminal-system/src/agentic-terminal.ts` | `status-idle` commits are created on BUSY -> IDLE, and `getHeadHash()`, `waitCommitted()`, `markDirty()`, `sliceDirty()` exist. | The IDLE hook can rely on existing terminal git HEAD truth. |
| `packages/terminal-system/src/terminal-db.ts` | `terminal_read_cursor` stores `(terminal_id, reader_actor_id, cursor_hash)`. | `readed HASH` is already modeled as actor-scoped cursor state. |
| `packages/terminal-system/src/terminal-control-plane.ts` | `readAuthorized({ remark: true })` reads from the actor cursor and commits the cursor to the returned `toHash`. | Auto-read can use the existing consuming read path. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | Current `handleStatusChange()` only emits a terminal actionable signal for some IDLE transitions; it does not compare HEAD vs read cursor or auto-read. | This is the missing bridge location. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | The current repaired bridge still checks HEAD/cursor only once on `BUSY -> IDLE`; it does not register a terminal commit waiter for the idle window. | This explains the user's pseudocode concern. |
| `packages/app-server/src/session-runtime.ts` | `buildTerminalSystemIngressEnvelope()` already turns `readTerminalRepresentation(... remark:true)` into a terminal world-fact attention envelope. | The read-result-to-attention path exists; it needs to be invoked at the IDLE hash comparison boundary. |
| `packages/app-server/src/session-runtime.ts` | Runtime startup assigned `focusedTerminalIds` from TerminalControlPlane directly; focused terminals that already existed before runtime start were not normalized/attached. | Product-bound shell2 reuse can miss `terminal.onStatus()` and therefore never reach the adapter idle hook. |
| `packages/terminal-system/src/managed-terminal.ts` | `ManagedTerminal.getHeadHash()` returns snapshot `seq`, while git-log reads/cursors are only committed when `profile.gitLog` is enabled. | This is a projection-vs-git-truth residual; the new fix must not deepen that leak. |
| `openspec/changes/archive/2026-05-05-decouple-terminal-activity-from-runtime-loop/design.md` | The old runtime had two terminal wake paths: `markTerminalDirty -> notifyInput("terminal")` and scheduler `waitCommitted(...)`; that change intentionally separated physical terminal changes from runtime ingress. | This explains why broad terminal wake behavior was removed. |
| `openspec/changes/archive/2026-05-05-decouple-terminal-activity-from-runtime-loop/specs/runtime-terminal-activity-bridge/spec.md` | The bridge may upgrade terminal changes to actionable ingress when an explicit action predicate matches. | `HEAD > readed HASH on IDLE` should be added as a named explicit action predicate. |
| Commit `208e6948 fix(runtime): purify room and terminal attention boundaries` | Removed high-score `terminal_idle_ready` attention task text and made idle-ready scheduler-only. | Evidence that an older idle-triggered attention behavior existed but was intentionally removed because it was too semantic/noisy. |
| Commit `3b2576fb refactor: gate terminal wakes through runtime activity bridge` | Removed direct scheduler `terminal.waitCommitted({ fromHash: terminal.getHeadHash() })` handles and removed direct `hasFocusedDirtyWork()` ready-now checks from wait logic. | Evidence that low-level terminal commit wake plumbing existed and was later collapsed into bridge semantics. |
| Commit `85993785 feat(terminal): scope read cursors by actor` | Added actor-scoped terminal read cursors and changed runtime terminal reads to consuming `remark:true`. | Evidence that the correct "readed HASH" primitive exists after the old broad wake behavior was removed. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before product-code work starts | Not yet committed; plan is still being revised. |
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

### Underlying Drive

恢复 terminalSystem 原先的闭环：终端本体变化由 git 记录；read cursor 表达 AI 上次真正读到哪里；IDLE 表达终端本轮输出稳定；如果稳定后的 HEAD 超过 read cursor，说明有新事实需要进入 attention。

### Final Visible Effect

AI 执行一个终端任务后，终端输出在结束/稳定到 IDLE 时会自动被读入 attention。用户不需要额外提醒 AI "你看一下终端"。如果 HEAD 没有超过 readed hash，则不会重复读、不会重复提交 attention item。

## Platform Diagnosis

- Current platform laws:
  - TerminalSystem owns git commits, status-idle commits, head hash, and actor-scoped read cursors.
  - Runtime bridge owns whether terminal facts become attention ingress.
  - AttentionSystem owns attention item commit and wakeable score semantics.
- Does this fit as a regular atom:
  - Yes. This is a missing bridge predicate between existing atoms.
- Does this require law upgrade:
  - Small law extension only: terminal IDLE bridge predicate `headHash > readCursorHash`.
- Breaking update stance:
  - Do not resurrect old broad terminal dirty wake behavior.
  - Do not resurrect `terminal_idle_ready` as model-visible task text.
- User confirmations still required:
  - Only whether focused-terminal eligibility is enough; current default is yes.

## Reverse-Inferred Design

### Interaction / Visual Story

1. Terminal receives output and becomes BUSY.
2. TerminalSystem debounces/throttles output into git commits.
3. Terminal becomes IDLE and emits the existing status transition.
4. Runtime terminal bridge reads:
   - current terminal git `HEAD`,
   - current actor read cursor hash.
5. If `HEAD` is not ahead of read cursor, no-op.
6. If `HEAD` is ahead, runtime performs existing consuming terminal read.
7. The read result is committed as a terminal attention item.
8. The reader cursor is advanced to the read result's `toHash`.

### Interface Shape

- Add a terminal bridge method or adapter path with product semantics:
  - `inspectIdleTerminal(terminalId)`
  - input: terminal id from BUSY -> IDLE transition
  - condition: focused/running/actionable + `headHash !== readCursorHash`
  - action: `readTerminalIngress(terminalId)` using existing `remark:true` path, then commit attention.
- Add or expose a read cursor lookup if the adapter cannot currently obtain `readed HASH` without doing a consuming read first.
- Keep read result formatting through `buildTerminalSystemIngressEnvelope(...)`.

### Data Shape

- Durable fact: terminal git HEAD.
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
