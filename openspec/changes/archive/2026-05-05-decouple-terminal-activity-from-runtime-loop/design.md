## Context

当前 runtime 对 terminal activity 的处理把三件不同性质的事实绑得太近：

1. terminal 物理世界是否真的发生了变化；
2. 这类变化是否只是 passive history / collaboration evidence；
3. runtime loop 是否应该立刻把这类变化升级成 attention ingress 并唤醒 AI。

现状里，`SessionRuntime.attachRuntimeTerminal(...)` 在 terminal semantic fingerprint 变化时直接 `markTerminalDirty(...)`；`RuntimeTerminalKernelAdapter` 一边通过 `onTerminalActivitySignal -> notifyInput("terminal")` 触发 loop，一边又在 scheduler 的 terminal `waitCommitted(...)` 路径上等待相同的 terminal 变化。随后 `buildTerminalSystemIngressEnvelope(...)` 直接把 terminal read 结果编码成 `world_fact` ingress，并以 `PASSIVE_TERMINAL_OBSERVATION_SCORE = 0` 提交到 runtime kernel。

这套法则虽然名义上把 passive terminal observation 记成 `score = 0`，但实际上仍然让普通 terminal 输出具备了“立刻惊动 runtime loop”的效果。共享 terminal 协作测试因此需要先 `pause()` 两边 runtime，才能只验证 terminal collaboration 本体，而不被 runtime AI loop 旁路搅动。与此同时，后台 dev server / watcher / playwright / storybook 之类残留进程也更容易被误判成 `bun` 或 runtime 不稳定，因为 terminal-based validation 目前缺少明确的 process hygiene discipline。

这个 change 的职责不是重写整个 scheduler，也不是取消 terminal 进入 attention world 的能力，而是把 terminal physical fact、bridge decision、loop wake cause 重新正交化。

## Goals / Non-Goals

**Goals:**
- 把 terminal 客观活动、passive observation history、runtime attention ingress 明确拆成独立层次。
- 引入一个显式的 terminal activity bridge，决定哪些 terminal 变化只留下 terminal-owned truth，哪些才升级成 runtime ingress。
- 让 actor-scoped terminal focus 继续表达“有资格被 runtime 关注”，但不再表达“任何 terminal semantic change 都必须立刻唤醒 AI loop”。
- 让共享 terminal collaboration/backend validation 在 runtime 未暂停的真实条件下稳定成立。
- 把 process/port/background-task hygiene 纳入 validation discipline，减少把环境热度误判成 `bun` 不稳定。

**Non-Goals:**
- 不重写 message adapter、task scheduler 或整个 attention debt/backoff law。
- 不把 terminal collaboration 泛化成新的全局 event bus 或 invitation framework。
- 不取消 terminal observation 进入 attention history 的能力。
- 不把 `session.pause()` 作为长期产品级解决方案保留下来；它只作为当前问题的证据，不作为未来正常验证前提。
- 不试图通过给测试增加更多 sleep、pause、特判 flag 来掩盖 law-boundary 问题。

## Decisions

### 1. 引入显式 `runtime-terminal-activity-bridge`，把 terminal facts 与 runtime ingress 断开

新增一个 bridge layer，terminal adapter 不再把“terminal changed”直接等同于“可提交 ingress”。bridge 先接收 terminal-owned activity signal，再输出两类结果：

- passive observation:
  - terminal truth 已更新；
  - 可写入 terminal activity / terminal attention history；
  - 但不触发 runtime loop 作为新的 actionable work。
- actionable ingress:
  - 满足显式 bridge 条件；
  - 才构造 `RuntimeSystemIngressEnvelope` 并交给 runtime kernel。

这样 terminal system 仍然拥有 terminal 的本体事实，runtime 只消费 bridge 明确放行的那一部分。

Alternative considered:
- 继续在 `buildTerminalSystemIngressEnvelope(...)` 或 scheduler 周围加更多 `if (sharedCollabTest)`、`if (pause)`、`recordActivity=false` 风格的特判
  - Rejected，因为这会把 source-specific hack 扩散到 runtime 平台层，违反当前 change 要修的正是 law boundary。

### 2. Focus 继续表示 eligibility，不再直接表示 immediate wake-up

`terminal-seat-focus` 继续保持 actor-scoped focus truth，但语义收敛为：
- runtime 只关心当前 actor focused terminal；
- focused terminal 的变化“可以被 bridge 评估”；
- 但 focused 不再意味着每一次 semantic change 都直接 `notifyInput("terminal")`。

也就是说，focus 决定“这是谁的终端上下文”，bridge 决定“这次变化是否值得惊动 AI”。

Alternative considered:
- 彻底去掉 focused terminal 与 runtime 的关系
  - Rejected，因为 runtime 仍然需要 terminal-backed reasoning，focus 仍然是 terminal attention 的 actor ownership 边界。

### 3. 收敛双唤醒路径，terminal wait 与 terminal signal 只能保留一套 bridge-owned 唤醒语义

现状里 terminal activity 至少有两条唤醒链路：
- `markTerminalDirty -> notifyInput("terminal")`
- scheduler 直接对 focused terminals 做 `waitCommitted(...)`

这会把同一 terminal 变化放大成多次 wake cause，并且让“physical change”与“ingress committed”混在一起。新的设计要求：
- terminal physical commit 由 terminal system 自己完成；
- runtime 是否醒来，由 bridge 发布单一 wake signal；
- scheduler 不再同时扮演 terminal observer 与 terminal ingress promoter 两个角色。

具体实现上，允许保留 wait handle 作为低层 observation primitive，但其结果只能交给 bridge；scheduler 本身不再据此直接判定 `terminal_activity => collect ingress now`。

Alternative considered:
- 保留两条路径，只通过去重 cursor/hash 降低重复
  - Rejected，因为重复不是唯一问题，语义混淆才是核心问题。

### 4. Passive terminal observation 仍可进 history，但默认不形成 unresolved runtime debt

现有 `PASSIVE_TERMINAL_OBSERVATION_SCORE = 0` 的意图是对的，但实现 still too eager。新的 law 保持：
- ordinary diff/snapshot observation 可以进入 terminal attention history；
- 但 bridge 默认把它归为 passive observation；
- 只有当存在显式 obligation，比如 terminal lifecycle mutation、explicit await match、approval-needed、delivery-verification-needed、或未来被命名的 terminal-owned action item 时，才升级为 actionable ingress。

这保证“看见了 terminal 新输出”与“AI 现在必须继续干活”不是同一个命题。

Alternative considered:
- 保持现在的 `score = 0` 设计不动，只接受 runtime 被频繁唤醒
  - Rejected，因为 `score = 0` 解决的是 debt，不是 wake-up。当前问题正是 wake-up 本身太激进。

### 5. Shared-terminal collaboration validation 必须在 live runtime 条件下通过，不再依赖 hidden pause shortcut

后续 backend/real-AI 验证要升级成：
- 两个独立 session / agent 实例；
- room 已联通；
- terminal shared seat 已建立；
- runtime 不依赖 `pause()`；
- B 写入 terminal 后，A/B 都能观察同一 terminal truth；
- runtime 若需要消费 terminal work，也只能通过 bridge 放行后的路径。

这条 law 的意义是把“terminal collaboration capability 成立”与“runtime AI loop 旁路是否安静”真正解耦。

Alternative considered:
- 保留 `pause()` 作为 test harness 规范步骤
  - Rejected，因为这会把 runtime interference 合法化，长期掩盖 architecture defect。

### 6. Process hygiene 进入 validation discipline，而不是留给人工经验

设计上新增验证纪律，而不是只靠工程师记性：
- terminal-backed validation 前必须确认目标端口、dev server、storybook、playwright、vite 等运行体属于当前 test/worktree；
- 需要串行运行互斥资源型任务，尤其是 storybook/vitest browser/vite；
- 测试结束后必须显式回收本轮启动的后台任务；
- 失败报告要区分“代码 law 失败”和“环境热度/进程残留干扰”。

这部分不是为了给 `bun` 甩锅，而是承认 terminal-based real validation 本来就会被 OS resource pressure 放大，所以需要 durable discipline。

Alternative considered:
- 把这部分只写进测试备注，不进入 architecture/design
  - Rejected，因为它已经影响系统可验证性，属于平台工程法则的一部分。

## Risks / Trade-offs

- [Risk] bridge 引入后，部分过去“terminal 一变 AI 就醒”的行为会收敛，可能暴露某些隐式依赖。 → Mitigation: 用 delta specs 明确哪些 terminal events 仍然是 actionable；对真实依赖 terminal follow-up 的 flows 增补 focused validation。
- [Risk] 如果 bridge 条件设计过窄，可能导致真正该处理的 terminal obligation 被压成 passive history。 → Mitigation: bridge 输出必须区分 passive/actionable，并为 actionability 保留明确、可扩展、可命名的 reason taxonomy。
- [Risk] 如果实现上仍保留 scheduler 对 terminal 的隐式 shortcut，bridge 会沦为表面抽象。 → Mitigation: design 明确要求收敛成单一 bridge-owned wake path，并在 tests 中断言无需 `pause()` 也稳定。
- [Risk] process hygiene discipline 增加测试脚本复杂度。 → Mitigation: 把 hygiene 尽量沉淀为可复用 helper/fixture，而不是每个测试手写。

## Migration Plan

1. 新增 `runtime-terminal-activity-bridge` capability，并为 `runtime-system-kernel-adapters`、`terminal-seat-focus`、`attention-runtime-kernel`、`real-ai-room-terminal-validation` 编写 delta specs。
2. 在 app-server 中抽出 terminal activity bridge，把 terminal physical observation、bridge decision、runtime ingress commit 分离。
3. 收敛 terminal double-wake path，移除 scheduler/adapter 里把 terminal dirty 直接视为 loop work 的隐式 shortcut。
4. 更新 shared-terminal collaboration tests 和 real-AI validation harness，改为在 live runtime 条件下验证，不再以 `pause()` 作为成功前提。
5. 为 terminal-backed validation 增加 process hygiene helpers，确保启动、端口占用、后台进程回收都能被客观记录与失败归因。

## Open Questions

- bridge 的 actionable taxonomy 第一版是否只覆盖 terminal lifecycle / await match / approval-needed / explicit delivery verification，还是还要纳入更多 terminal-owned obligation 类型。
- scheduler 最终是否彻底移除 terminal `waitCommitted(...)` 直连路径，还是保留为 bridge 的内部 observation primitive。
- passive terminal observation 是否仍然进入 attention history，还是部分场景应只留在 terminal activity ledger 而不进入 attention world。
