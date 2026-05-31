# Intent Document

## Current Round

- Round: 1
- Status: research-plan ready for review
- Previous plan backup: none

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

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | terminalSystem originally had a requirement to debounce+throttle terminal changes into git commits, locate the last read git commit hash, and when LoopBus stops inspect git-log for new commits, convert them into `commit-attention-item`, and wake LoopBus. | This is a platform-law repair across terminal git truth, actor read cursors, runtime adapter promotion, and attention wake semantics. |
| 1 | User | If LoopBus is working, AI should use terminal-cli to query by itself. | The runtime must not interrupt an active model loop with every terminal tick; promotion belongs at the loop-settled boundary. |
| 1 | User | Use OpenSpec vision to drive the work. | `plans/plan.md` is the Intent Document SSOT before specs/tasks/implementation. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/terminal-system/src/committer.ts` | `Committer.schedule()` already implements debounce and throttle; `forceCommit()` flushes pending terminal truth. | The snapshot cadence law exists. This change should not reimplement debounce/throttle. |
| `packages/terminal-system/src/agentic-terminal.ts` | `AgenticTerminal` creates `TerminalGitLogger` only when `gitLog` is enabled, schedules commits from PTY output, commits `status-idle`, exposes `markDirty()`, `sliceDirty()`, `getHeadHash()`, and `waitCommitted()`. | TerminalSystem already owns physical git-log truth and diff query primitives. |
| `packages/terminal-system/src/terminal-db.ts` | `terminal_read_cursor` stores `(terminal_id, reader_actor_id, cursor_hash)`. | Last-read git hash is actor-scoped; the hook must consume the runtime actor cursor, not a terminal-global cursor. |
| `packages/terminal-system/src/terminal-control-plane.ts` | `readAuthorized({ remark: true })` advances only the reader actor cursor; `remark: false` inspects without consuming. | The hook can use the existing consuming read boundary instead of inventing cursor state. |
| `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | Dirty terminal ids are queued only when focused, running, and actionable. `drainIngress()` refuses to drain while loop is paused and reads only IDLE terminals. | The observation queue exists, but its collection is tied to normal input draining, not the loop-settled hook described by the user. |
| `packages/app-server/src/session-runtime.ts` | `buildTerminalSystemIngressEnvelope()` reads terminal representation with `remark: true`, builds a `world_fact` envelope, but uses `PASSIVE_TERMINAL_OBSERVATION_SCORE = 0`. | Existing terminal observations can become history, but score 0 cannot become active attention debt or a wakeable item. |
| `packages/app-server/src/session-runtime.ts` | `stopLoop()` currently wakes `attention` only so commit waiters settle; it does not inspect terminal git-log. | The explicit hook for stopped/settled LoopBus terminal inspection is missing. |
| `packages/app-server/src/session-runtime.ts` | Loop state transition to `waiting_commits` is already observed in `onLoopStateChange`. | This is the likely correct meaning of "LoopBus停下来": the active cycle has settled and the runtime is waiting for new committed input. |
| `packages/app-server/test/runtime-terminal-kernel-adapter.test.ts` | Existing adapter tests prove passive dirty observations do not emit ingress unless actionable, and lifecycle scheduler signals stay out of host commits. | New tests must preserve passive-vs-actionable separation. |
| `packages/app-server/test/session-runtime.attention-system.test.ts` | Existing terminal draft tests prove focused terminal output is committed into attention history without active debt. | The repair must add a separate actionable promotion path, not change all terminal history into debt. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not yet committed; only `plans/plan.md` is being created in this round. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started. |
| Normal archive | Commit containing `openspec archive <change>` result | Not started. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not required yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/runtime-system-kernel-adapters/spec.md` | Runtime systems integrate through neutral adapters; terminal observation and ingress promotion are distinct phases; bridge owns terminal wake decisions. | Extend. Add a loop-settled inspection hook as adapter/bridge law. |
| `openspec/specs/terminal-control-plane/spec.md` | Focused terminals feed attention-source pipeline; focused observations default to passive history unless explicitly actionable; read cursors are actor-scoped. | Extend. Define the loop-settled git-log delta as an explicit actionable predicate. |
| `openspec/specs/runtime-terminal-contract/spec.md` | Runtime terminal reads carry representation metadata and actor cursor metadata. | Reuse. The hook should reuse the same payload shape. |
| `packages/terminal-system/SPEC.md` | Terminal log commits use debounce+throttle; BUSY -> IDLE commits a status snapshot; read cursor consumption is actor-scoped. | Reuse and clarify that TerminalSystem remains the git/cursor truth owner, not attention owner. |
| `packages/attention-system/SPEC.md` | AttentionSystem owns attention truth; external systems may submit durable attention truth, but attention does not own terminal internals. | Reuse. The runtime bridge may commit attention, but TerminalSystem must not import attention internals. |
| `packages/app-server/SPEC.md` | App-server is the composition root; focused terminal observations default to queryable attention history; terminal idle/focus/unfocus are scheduler signals by default. | Extend. Add the explicit settled-loop terminal delta promotion rule. |
| `openspec/changes/archive/2026-04-27-actor-scoped-terminal-read-cursors/*` | Terminal output is shared physical fact; cursor state is a per-reader projection; `remark` and `recordActivity` are orthogonal. | Reuse. This is the exact cursor law the hook should depend on. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| "往底层深入" | Repair platform law, not a local caller workaround. | Do not patch one CLI command; fix the runtime/terminal/attention contract. |
| "terminalSystem使用attentionSystem的API" | Historical intent: terminal changes were supposed to be converted into attention truth through a system boundary. | The new architecture should preserve the effect without direct package coupling. |
| "debounce+throttle自动抓取快照" | Terminal physical changes are batched into durable snapshots/commits. | This is TerminalSystem-owned truth. |
| "形成git-commit" | Terminal output history is stored as git commits for diff/query/cursor use. | Git log is the durable change ledger. |
| "最后一次阅读的git-commit-hash" | Per-reader cursor over terminal git commits. | The runtime actor's read cursor anchors unseen terminal output. |
| "如果LoopBus在工作中" | During an active model cycle, the assistant can query terminal tools itself. | Do not convert every tick into interrupting model work. |
| "一旦停下来" | Current inference: LoopBus transitions back to `waiting_commits`, not necessarily session pause/stop. | The active cycle settled and the scheduler is waiting for new input. |
| "commit-attention-item" | Commit a durable attention item from terminal world fact. | This must be wakeable only when bridge-approved actionable. |
| "激发AI的LoopBus" | The committed item should make the next LoopBus round start. | The item needs wakeable attention semantics, not only passive history. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | Current code and specs were enough to localize the missing law. | No spike needed before specs. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| "LoopBus停下来" should mean `waiting_commits` after a cycle settles, or explicit `pause/stop`? | The hook location changes: loop-state transition vs `stopLoop()`. | Use `waiting_commits` transition for automatic continuation; `pause/stop` should remain user-controlled suspension. |
| Should hook-promoted terminal deltas carry positive attention score? | Score 0 commits history but does not wake LoopBus as active work. | Yes. Keep ordinary passive terminal history at score 0; only loop-settled, focused, actionable, unread terminal deltas get positive score. |
| Which terminals are inspected on loop-settled? | Inspecting all terminals would wake on unrelated background noise. | Focused + running + actionable terminals only; BUSY terminals wait until IDLE. |
| Should the hook consume the actor cursor with `remark:true`? | Without cursor consumption, the same git delta can repeatedly wake the loop. | Yes. Use the runtime actor cursor and advance it only after a meaningful envelope is committed or explicitly consumed by terminal read semantics. |

## Intent

### Surface Intent

修复 terminalSystem 的底层工作方式：终端输出通过 debounce + throttle 形成 git-log；runtime/LoopBus 能基于最后一次阅读的 git commit hash 判断是否有新终端事实；当 LoopBus 从工作状态停下来时，如果终端 git-log 有新提交，就把这个事实提交成 attention item，并让 LoopBus 继续推进。

### Underlying Drive

用户要恢复的是一种 "terminal as operating-system workbench" 的闭环：AI 发起或观察终端工作后，不应该因为模型一轮结束就丢失对终端后续变化的注意力；也不应该靠人工再发消息才能继续。终端事实、阅读游标、attention 义务、LoopBus 唤醒要形成一条可追责、可测试、可复用的平台法则。

### Final Visible Effect

当 AI 启动了一个会在终端里持续输出的工作后，如果输出在模型调用期间或刚结束后发生变化，operator 不需要手动提醒。LoopBus 回到等待态时会自动检查 focused terminal 的 git-log；如果发现运行时 actor 尚未读过的新提交，就提交一条可见 terminal attention item，并触发下一轮 AI 继续读取、判断和行动。相反，纯焦点变化、空白快照、未聚焦终端噪声、仍在 BUSY 的终端不会误触发任务义务。

## Platform Diagnosis

- Current platform laws:
  - TerminalSystem owns terminal physical truth: PTY/headless snapshot, debounced/throttled persistence, git-log commits, and actor-scoped read cursors.
  - AttentionSystem owns attention truth: contexts, items, scores, context mutation, durable recovery.
  - App-server/runtime is the composition root and scheduler bridge: it may convert adapter ingress into attention commits, but must not become terminal or attention durable truth owner.
  - Runtime adapters separate observation from promotion. Terminal dirty/status signals are observations until a bridge-approved predicate promotes them into ingress.
- Does this fit as a regular atom:
  - Partially. Terminal git/cursor primitives already exist as atoms.
  - The missing behavior crosses scheduler lifecycle, terminal observation, and attention promotion, so it is not a single terminalSystem method.
- Does this require law upgrade:
  - Yes. Add a loop-settled terminal inspection law to the neutral runtime adapter boundary.
  - The law must say: at the LoopBus settled boundary, the bridge may inspect focused/actionable terminal git-log deltas and promote meaningful unread deltas into wakeable attention.
- Breaking update stance:
  - Prefer the clean law even if it changes current passive-only terminal behavior.
  - Do not add compatibility glue that lets `AgenticTerminal` import attention or lets `SessionRuntime` hardcode ad hoc terminal attention branches outside the adapter boundary.
- User confirmations still required:
  - Exact score/ranking for hook-promoted terminal items.
  - Whether `session.pause` should suppress the hook, which this plan currently assumes.

## Reverse-Inferred Design

### Interaction / Visual Story

1. AI starts or observes terminal work.
2. Terminal output changes. TerminalSystem batches output through debounce/throttle and creates git commits.
3. During the active LoopBus/model cycle, the runtime records terminal dirtiness but does not interrupt the model with every terminal tick.
4. The model cycle settles and LoopBus enters `waiting_commits`.
5. Runtime host broadcasts a scheduler-settled event to adapters.
6. Terminal adapter checks focused, running, actionable terminals. BUSY terminals remain queued until IDLE.
7. For each eligible terminal, the adapter reads terminal ingress through the existing runtime terminal representation path, using the runtime actor cursor.
8. If there is a meaningful unread diff/snapshot, runtime commits a terminal `world_fact` attention item with wakeable score and notifies LoopBus.
9. LoopBus starts the next round from attention truth. The AI sees a terminal item and can use terminal-cli to inspect deeper.

### Interface Shape

- Add a neutral runtime scheduler hook, named along these lines:
  - `RuntimeSystemKernelAdapter.onSchedulerSettled?(input)`
  - `RuntimeKernelHost.notifySchedulerSettled(input)`
- Add terminal adapter behavior behind that hook:
  - inspect eligible dirty/focused terminals,
  - read one terminal ingress envelope per terminal,
  - commit via host with `notifyLoop: true`,
  - keep duplicate physical changes collapsed to one wake decision.
- Keep existing AI-facing terminal CLI behavior:
  - When the AI is already working, it can explicitly call `terminal read` / `terminal await` / related terminal tools.

### Data Shape

- Durable facts:
  - terminal git commits,
  - `terminal_read_cursor` per `(terminalId, readerActorId)`,
  - attention commits/items/scores,
  - source refs like `tty:<terminalId>`.
- Projections:
  - focused terminal set,
  - dirty terminal queue,
  - scheduler signals,
  - browser terminal snapshots.
- Must not be confused:
  - A terminal dirty mark is not an attention item.
  - A passive terminal history commit with score 0 is not a model obligation.
  - A scheduler signal is not durable terminal truth.
  - A terminal read cursor is not global terminal state.

### Architecture Shape

- Platform law update:
  - Runtime host exposes a scheduler-settled adapter notification.
  - Terminal adapter owns terminal observation-to-promotion decisions.
  - SessionRuntime only emits the lifecycle event at the LoopBus phase boundary and supplies existing terminal read/envelope functions.
- Terminal atom:
  - Remains responsible for debounce/throttle, git commits, sliceDirty/markDirty/waitCommitted, control-plane read cursor consumption.
  - Does not import attentionSystem or LoopBus internals.
- Attention atom:
  - Remains responsible for commit, score, focus state, staging, and durable wakeable attention projection.
  - Does not inspect terminal git-log itself.
- Forbidden couplings:
  - No `terminalSystem -> attentionSystem` direct import.
  - No `AgenticTerminal` callback that writes attention.
  - No "terminal dirty means model must act" shortcut.
  - No terminal-global read cursor fallback for runtime actor reads.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Score for hook-promoted terminal item | Positive score creates real model obligation. | Use a named positive score for loop-settled terminal deltas; keep passive history at score 0. |
| Pause/stop semantics | User pause may mean "do not continue automatically". | Hook runs on `waiting_commits` settle only; explicit pause/stop suppresses it. |
| Focus scope | Inspecting unfocused terminals may create noisy autonomous work. | Only focused + running + actionable terminals. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
  - Update `runtime-system-kernel-adapters` with scheduler-settled adapter hook and terminal bridge ownership.
  - Update `terminal-control-plane` with actor-scoped git-log cursor consumption at settled-loop inspection.
  - Update `runtime-terminal-contract` or `app-server` durable spec with wakeable terminal observation semantics.
- [ ] 3. Write BDD tasks from specs.
  - Adapter unit scenarios for settled-loop inspection, BUSY requeue, passive/noop filtering, and duplicate collapse.
  - Session runtime scenarios for terminal output changing during active cycle, LoopBus entering waiting state, attention item committed, and next loop waking.
  - Regression scenarios proving passive terminal history remains score 0 and non-focused terminal noise does not wake.
- [ ] 4. Implement tasks.
  - Add neutral scheduler-settled adapter hook in runtime host/interface.
  - Implement terminal adapter settled inspection using existing `readTerminalIngress`.
  - Add a separate wakeable terminal score path for loop-settled actionable deltas.
  - Wire LoopBus `waiting_commits` transition to runtime host notification.
  - Preserve actor cursor semantics through existing `readTerminalRepresentation(..., remark: true)`.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Is `waiting_commits` exactly the "LoopBus停下来" hook? | It determines whether the hook fires after every model cycle or only after explicit pause/stop. | Yes, `waiting_commits` is the automatic continuation boundary. |
| Should hook-promoted terminal deltas always be `score > 0`? | Without positive score, committed history will not reliably wake the model. | Yes, but only for bridge-approved settled-loop terminal deltas. |
| Should terminal IDLE status be required before promotion? | Reading while BUSY may wake on incomplete output. | Yes. BUSY remains queued and is inspected after IDLE/status snapshot commit. |
| Should `terminal await` participate in the same hook? | Await already observes git/snapshot truth but has a caller-driven contract. | Not in this change; keep await as explicit tool behavior. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Let `AgenticTerminal` or `TerminalGitLogger` directly call attention APIs. | Violates atom ownership; terminalSystem would become attention writer and scheduler participant. |
| Treat every terminal dirty mark as an attention obligation. | Breaks existing passive-observation law and would wake on renderer noise or background output. |
| Rebuild debounce/throttle or git-log storage. | Existing TerminalSystem already implements those primitives. |
| Use a terminal-global last-read hash. | Breaks actor-scoped cursor law and multi-actor terminal semantics. |
| Put the hook only in `stopLoop()`. | `pause/stop` are user/session lifecycle controls; the requested autonomous continuation belongs to LoopBus settled/waiting boundary. |

## Exit Conditions

- Default max review iterations: 3
- Issue recurrence threshold: 2 materially similar self-review failures require revising the Intent Document before more code.
- Custom exit condition from intent: A terminal output change committed to git while LoopBus is active is automatically promoted after the cycle settles, advances the runtime actor cursor once, creates one wakeable terminal attention item, and starts the next LoopBus round; passive terminal history and non-focused/noisy changes remain non-obligating.
