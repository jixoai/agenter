# Intent Document

## Current Round

- Round: 1
- Status: Drafting the intent document after the prompt-authority implementation commit `18065e15`; code removal has not started.
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

> `“开一个新 session，直接发一句 你好” 这条主链路没通` —— 你当然要新建房间才能发消息啊，不然你怎么发的？干发？

> 所以你这里的 chat.send 到底是意味着什么？我也没看懂。我从来都没有说过这里面有个  chat 的东西
>
> 没有 primary room，正如没有 primary terminal 一样。未来 System 会越来越多，所以都是按需使用。
>
> 代码注释要写清楚文件真源这个原则

> 展开来解释一下这里面的 chat 到底是什么回事

> 那我知道了，这个确实是很早期的时候还没有 message system 的时候残留下来的一个东西。所以接下来要把这个肿瘤给剔除掉的话，本身就是一个比较高风险的行动。你先把代码提交干净，然后我们使用 openspect 去推进这个任务

> 1. 明确报错：必须指明房间。如果指明了房间还报错，那就是另外的错误了，可能是 id 错了，有可能房间被 archived 或者完全清理掉了。
> 2. 没有“保护房间”这种概念。目前不需要这些奇奇怪怪的辅助概念
> 3. agree
> 4. 准确来说，不是 session 于 room 的关系。
> 我先解释一下这里的知识背景（如果你有新的认知，务必更新到代码注释中）：messageSystem、terminalSystem，都属于“外部系统”，都是可以卸载的系统。真正硬绑定的，表面上只有两个：attentionSystem、workspaceSystem（authSystem 属于隐形的）。所以正确的认知是 session 有哪些 attentionContext（来自 attentionSystem），而 attentionContext 有对应的 source，这些 source 可能是来自 messageSystem、terminalSystem、taskSystem 等等。
> 有了这个背景知识，再来回答这个问题：只需要面向 attentionContext，去理解attentionContext目前的信息、状态就行了。这也是为什么，messageSystem 需要去对接 attentionSystem，做好一些映射和绑定，了解 attentionContext 某种程度上就聊了 messageSystem+roomManagement 的一些信息。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | 发消息必须先有房间；“新 session 直接发一句你好”不成立。 | Session 不能偷偷合成一条隐藏 chat lane。 |
| 2 | User | `chat.send` 不是用户定义的一等概念，当前名词系统不接受它。 | `chat.*` 需要被视为历史兼容残留，而不是未来法则。 |
| 3 | User | “没有 primary room，正如没有 primary terminal 一样。未来 System 会越来越多，所以都是按需使用。” | Session 不应把 room 绑定成默认宇宙常量；系统应该按需挂载。 |
| 4 | User | 代码注释要把“文件真源”原则写清楚。 | 这次变更需要把 truth/projection/compatibility 分层写明白。 |
| 5 | User | 这是 message system 之前的残留，“剔除肿瘤”是高风险行动。 | 这不是常规原子迭代，而是清理旧法则的范式升级。 |
| 6 | User | 先把现有 prompt-authority 代码提交干净，再走 OpenSpec。 | 本 change 只产出 OpenSpec，不混进刚才的实现提交。 |
| 7 | User | 没有默认兜底发消息；如果没指明房间，就明确报错。 | 默认 room 路由不是可保留语义，只能作为待删除兼容残留。 |
| 8 | User | 不存在“保护房间”概念。 | 任何基于 primary/default room 的保护规则都应视为待删辅助逻辑。 |
| 9 | User | `messageSystem` / `terminalSystem` 是外部系统，可卸载；session 表面硬绑定的只有 `attentionSystem`、`workspaceSystem`（`authSystem` 隐形）。 | 这次 change 的核心模型必须从 `session -> room` 改成 `session -> attentionContext -> source`。 |
| 10 | User | 只需要面向 attentionContext 去理解当前信息和状态；messageSystem 需要对接 attentionSystem 做映射和绑定。 | 验收和后续 specs 应以 attentionContext/source 为中心，而不是以 primary room 字段为中心。 |
| 11 | User | `primaryRoomId` 最终要彻底清理丢掉。 | `primaryRoomId` 的终局已经确定为完全删除，不再讨论是否保留。 |
| 12 | User | 一步删干净，并把之前讨论过的副作用和对应方案一起清掉。 | 这次变更不允许 staged keep-alive；相关默认路由、通知锚点、public surface、real harness 假设必须同次收口。 |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/app-server/src/app-kernel.ts:5055-5064` | `sendChat(...)` 只是 `ensureRuntime(sessionId)` 后转发到 `runtime.pushUserChat(...)`。 | `chat` 不是独立系统，只是 session/runtime 旧入口。 |
| `packages/app-server/src/session-runtime.ts:8606-8632` | `pushUserChat(...)` 先 `requireDefaultChatChannel()`，再追加本地 user message，并通过 `notifyInput("user")` 唤醒后续循环。 | 这条路径把“默认 chat channel”硬编码进 runtime。 |
| `packages/app-server/src/trpc/router.ts:691-713` | 公开控制面仍有 `chat.send / chat.list / chat.cycles` 三个 surface。 | 旧词汇还在 API 层暴露，继续塑造错误心智模型。 |
| `packages/app-server/src/session-ledger-view.ts:141-165` | persisted “chat message” 实际是从 heartbeat/session ledger 投影出来的 projection。 | `chat.list` 不是 transcript truth，只是投影视图。 |
| `packages/app-server/src/chat-cycles.ts:5-33` | `ChatCycle` 描述的是模型/compact 循环投影，而不是 room transcript。 | `chat.cycles` 名称把 runtime cycle 错当成 room 聊天真相。 |
| `packages/app-server/src/app-kernel.ts:1399-1405` | `bindSessionPrimaryRoomId(...)` 会在 session 元数据上补一个 `primaryRoomId`。 | “primary room” 仍被当成 session 固有字段持久化，而用户刚确认这不是正确本体。 |
| `packages/app-server/test/app-kernel.test.ts:449-474` | 测试已经证明：没有 attached room 时 `sendChat` 会失败，attach 之后才成功。 | 现状已经在行为上承认“先有 room 再发消息”，只是词汇和旧外壳还没清干净。 |
| `SPEC.md:32-36` | room durability、room revision、transcript truth 都属于 room-management/message-system 边界。 | `app-server` 的 `chat.*` 不应再冒充 room 真相层。 |
| `SPEC.md:126` | `room` 是当前聊天 channel 的承载概念，不能把 `room` 与 `chat`、`message-system` 混为一个概念。 | 仓库级法则已经站在 room 一侧，代码仍残留旧词汇。 |
| `packages/app-server/SPEC.md:21` | `session.create` / `session.start` 的 cold boot 不会自动挂 room。 | “没有 primary room”与 durable spec 方向一致；问题在于历史兼容残留尚未清理。 |
| `packages/app-server/src/session-runtime.ts:2512-2778` | runtime 仍把 `primaryRoomId` 当默认 source fallback、默认 visibility target、默认写入路由。 | 说明当前实现仍是 `session -> room` 脑回路，需要改回 `attentionContext -> source`。 |
| `packages/app-server/src/session-runtime.ts:3877-3933` | default/built-in room 仍被禁止 archive/delete。 | 这条“保护房间”辅助逻辑已被用户明确否决。 |
| `openspec/changes/decouple-room-management-from-message-system/specs/message-system-surface/spec.md:33-38` | 可复用 chat surface 只负责 transcript/composer 行为，不应吞并 room-management 语义。 | 需要保留真正的 room transcript UI surface，但不能再把它当 session 内建 `chat` 系统。 |
| Real walkthrough `2026-06-03` | 新建 real room 后发送 `"你好"` 成功；session `00ca43a6-c45c-5628-b398-6f0e5e1d4a7b` 的 room id 为 `0xc0e1baa7506909a7e3a401d1dd88b81f0972fa54`。 | 真实流程证明“room-first”是可工作的主链路。 |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not yet. This round is drafting `plans/plan.md`. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not yet. No code for this change has started. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not yet. |
| Normal archive | Commit containing `openspec archive <change>` result | Not yet. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `SPEC.md:32-36,126` | room truth belongs to room-management; room is the carrier concept, not `chat`. | Reuse and enforce. |
| `packages/app-server/SPEC.md:21` | session cold boot does not auto-attach room/terminal/workspace. | Reuse; code residue should be brought back under this law. |
| `openspec/changes/align-message-follow-up-and-room-lifecycle/specs/message-chat-control-plane/spec.md` | room lifecycle and follow-up delivery already lean on explicit room semantics. | Reuse; do not regress to hidden default chat routing. |
| `openspec/changes/decouple-room-management-from-message-system/specs/message-system-surface/spec.md` | reusable transcript/composer UI stays ordinary-user-focused, while room-management stays outside it. | Reuse; keep the UI surface, retire the session-level `chat` facade. |
| `openspec/changes/file-backed-prompt-authority` | just landed a file-truth cleanup backed by explicit comments and runtime evidence. | Reuse the same “truth vs projection vs compatibility” discipline when documenting chat removal. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `没有 primary room` | room 不是 session 出生自带的宇宙常量。 | A room exists only when explicitly created/attached. |
| `正如没有 primary terminal 一样` | room/terminal 都是按需 system，不能偷变成主字段。 | Do not hardwire one default authority per session. |
| `都是按需使用` | system 数量会增长，session 只能按需接入能力。 | Authority attachment must stay explicit and plural-friendly. |
| `必须指明房间` | 没有指定 room 就直接报错，不做隐式兜底。 | Absence of an explicit room is a caller error, not a fallback trigger. |
| `没有保护房间` | 不要发明 built-in/protected room 这种辅助概念。 | Archive/delete policy must come from explicit room state, not hidden default-role semantics. |
| `session 有哪些 attentionContext` | session 的可理解状态核心是 attention context，而不是 room 列表本身。 | Session truth should be modeled through attention contexts and their sources. |
| `外部系统` | message/terminal/task 等 system 可卸载，只通过 source 接入 session。 | Room/terminal are source systems, not session-owned built-ins. |
| `chat.send` 我没说过 | 旧命名已经偏离当前产品语言。 | The public API vocabulary needs cleanup, not just internal refactor. |
| `肿瘤` / `剔除掉` | 这是早期残留、已知架构异物。 | Treat as risky legacy excision, not a cosmetic rename. |
| `文件真源` | truth、projection、compatibility 必须写清楚，不要模糊。 | Comments and specs must explicitly name the authority source. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | The runtime walkthrough and code reads already answered the discovery questions. | No spike required before specs. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| none | The major architecture cuts for this round are already decided. | Proceed to specs/tasks and then implementation planning. |

## Intent

### Surface Intent

把 `chat.*` 从 Agenter 的一等概念中清掉，恢复 “room/message 才是聊天真相，session 只是按需挂 system 的运行时” 这套语言和接口边界。

### Underlying Drive

当前系统已经有了 message-system 与 room-management 的法则，但 pre-message-system 时代留下的 `chat.send / chat.list / chat.cycles / primaryRoomId` 还在 runtime、API、测试和心智模型里继续发声。它们不是简单命名问题，而是在持续制造错误的系统物理：

1. 把 room truth 误投影成 session 内建 `chat` 系统。
2. 把 runtime cycle projection 误叫成 “chat history”。
3. 把按需挂载的 room authority 偷偷降格成 session 的默认属性。

用户要剔除的不是某个函数名，而是这整套错误投影。

### Final Visible Effect

当这个 change 正确时，操作者会看到并信任这些事实：

- 创建 session 本身不代表已经拥有任何 room。
- 要发消息，必须显式指明 room/channel；没指明就明确报错。
- 对外 surface 使用 `room` / `message` / `heartbeat cycle` 之类真实名词，不再让 `chat` 冒充真相层。
- 如果 room id 错了、room 已 archived、或者 room 已被清掉，错误会如实暴露，而不是退回某个默认房间。
- runtime/inspection 仍能查看循环历史，但那被明确标成 projection，而不是 transcript truth。
- operator 能从 attentionContext 看到当前上下文绑定了哪些 source，以及这些 source 分别来自 messageSystem、terminalSystem、taskSystem 等外部系统。

## Platform Diagnosis

- Current platform laws:
  - room truth belongs to room-management/message-system.
  - session cold boot does not auto-attach room.
  - messageSystem / terminalSystem are unloadable external systems.
  - session-visible work should be understood through attentionContext and source binding.
  - projections can exist, but cannot冒充 truth。
- Does this fit as a regular atom: no.
- Does this require law upgrade: yes. The repo law is already ahead; the code still carries an older law fragment.
- Breaking update stance: prefer a one-cut breaking cleanup over any compatibility carry-over.
- User confirmations still required:
  - none for the architecture direction captured in this round

## Reverse-Inferred Design

### Interaction / Visual Story

理想观察流不是 “session -> chat”，也不是 “session -> room”，而是：

1. session 启动，只说明 AvatarRuntime 在运行。
2. attentionContext 告诉 operator 当前有哪些 source 在起作用。
3. 如果某个 source 来自 messageSystem，operator 再沿着对应 room/message surface 去读写。
4. 如果没有显式 room source，就不能发消息，并得到直接错误。
5. runtime cycle/compact/heartbeat 历史作为独立 inspection 面存在，不冒充 transcript。

### Interface Shape

- public control plane 不再把 `chat` 作为顶层语义入口。
- `chat.send` 这类 session convenience surface 要么被删除，要么被显式标记为 compatibility-only 并从默认文档/心智模型中退出。
- room transcript 分页继续属于 message/room surface。
- cycle history 如果保留，应迁到 `heartbeat` / `session-ledger` / `runtime-cycle` 之类更接近本体的 surface。
- runtime 内部如果还需要“把一条输入交给某个 room”的 helper，也必须要求显式 room source 或显式 room id；不能再从 session 默认字段偷答案。

### Data Shape

- Durable truth:
  - attention contexts and their state
  - room catalog / grants / transcript / read-state
  - effect ledger for visible message creation
- Projection:
  - runtime cycles
  - heartbeat-derived message views
  - session inspection pages
- Suspicious coupling to unwind:
  - `primaryRoomId` currently mixes “legacy compatibility field”, “default send/reply route”, “default unread bucket”, and “default attention source fallback”.

### Architecture Shape

- `message-system` / room-management owns room truth.
- `app-server` owns orchestration and projection, not a parallel chat truth.
- `SessionRuntime` should reason first through attentionContext/source bindings; message/terminal/task are external source systems, not session-owned built-ins.
- compatibility residue, if it exists temporarily, must be explicitly named as compatibility and fenced away from durable truth comments/specs.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| none | The remaining work is execution and validation, not architecture selection. | Proceed under the one-cut cleanup decision. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Write specs from the intent.
- [x] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Which public consumers currently depend on `chat.*` naming? | This affects migration breadth and review evidence, even though the direction is already fixed. | Assume at least tRPC callers, harness helpers, and tests need migration evidence. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep `chat.*` as the future public naming and only patch docs | That preserves the wrong ontology. |
| Hide missing room authority by synthesizing a default room at send time | This directly violates the user's “必须指明房间” rule. |
| Keep a built-in protected room concept | The user explicitly rejected any hidden "protected room" helper concept. |
| Only rename UI text while leaving runtime/API/test vocabulary unchanged | That would be projection cleanup without law cleanup. |
| Treat `chat.cycles` as transcript truth | Cycle history is a runtime projection, not room durability. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: 3
- Custom exit condition from intent:
  - `chat` no longer appears as a first-class room/message truth surface in public contracts,
  - `primaryRoomId` no longer exists in the durable session model or runtime routing path,
  - the side effects that used to lean on default-room semantics are cleaned in the same cut,
  - operator-facing language makes “session exists”, “attentionContext exists”, and “message room source exists” visibly distinct.
