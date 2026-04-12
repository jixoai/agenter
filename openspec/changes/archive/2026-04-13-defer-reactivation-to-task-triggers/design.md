> Status: Superseded on 2026-04-13. The later architecture law keeps unresolved debt wakeable for `focused` and `background` contexts, keeps `muted` dormant by default, and uses notification-class push as the force-wake path. This proposal is archived for history, not implementation.

## Context

当前 runtime 已经有一套 attention debt containment 机制：当 active attention 仍然存在时，scheduler 会把 waiting reason 视为 `attention_debt` 或 `attention_backoff`，并通过定时器再次唤醒 LoopBus。这样做比“立即死循环重跑”更安全，但本质上仍然让内核承担了 deferred planning 的职责。

当前代码里的关键耦合点已经比较明确，后续实现应直接围绕这些点拆分：

- `session-runtime.ts#resolveLoopWaitingReason()`：把非零 debt 直接投影成 `attention_debt` / `attention_backoff`
- `session-runtime.ts#waitForAnyInput()`：把 attention debt 当成合法 wake cause
- `session-runtime.ts` 主循环等待段（`attentionDebtTimer` / `attentionDebtNextWakeAt`）：内建 timer/backoff 负责下一轮自动唤醒
- `session-runtime.attention-system.test.ts` 里现有 “unresolved attention debt self-wakes” 测试：它们目前把旧 law 固化成回归预期，后续必须反转

这些 touchpoint 说明本 change 不是“加一个 taskSystem”那么简单，而是要把 LoopBus 自身的 runnable 判断纯化回输入驱动。

用户给出的新原则更接近第一性原理：

- LoopBus 像生命体征系统，负责持续存在、等待输入、收集输入、调用模型
- 它不应该直接判断“有没有必要现在再做一轮”
- 如果未来确实还要再做事，应由更高层的 planning/trigger system 显式编码这个意图

一个典型例子是“每天 5 点叫我起床”：

1. 用户发来请求
2. Avatar 回复确认
3. Avatar 把未来触发器写入 task/trigger system
4. Avatar 收尾当前 attention
5. 到了 5 点，由 trigger 命中后重新 commit 一个 attention item
6. runtime 再次工作

## Goals / Non-Goals

**Goals:**

- 把 “debt 仍存在” 和 “现在值得再跑一轮” 正交拆开
- 让 future reactivation 成为 task/trigger system 的职责，而不是 LoopBus 的隐式内建行为
- 保持 attention-first：重新激活仍然必须通过 committed attention items 进入 runtime
- 允许 AI 把未来动作安全委托给 trigger/task 后收尾当前 attention

**Non-Goals:**

- 本 change 不实现完整的 task system
- 本 change 不引入复杂的条件 DSL 或 trigger execution engine
- 本 change 不改变 attention item / attention commit 的基本数据模型
- 本 change 不解决所有“AI 什么时候该回复”的策略问题，只解决 deferred reactivation 的平台边界

## Decisions

### 1. `score > 0` 只表示 debt exists，不再默认驱动自动重跑

理由：

- 非零分数表达的是 obligation existence，不是 runnable permission
- 继续让 debt 自己驱动 loop，会把内核变成一个半隐式 planner
- 这样会鼓励把“以后再说”的意图偷塞进 score，而不是显式建模触发条件

替代方案：

- 维持当前 timer/backoff 自动唤醒
  - 缺点：LoopBus 继续承担 deferred planning 语义，边界不纯

### 2. Future reactivation 由 task/trigger system 建模

理由：

- 时间、事件、条件判断、本地小模型评估，本质上都属于“何时重试/何时再做”的规划问题
- 这些能力天然属于 task/trigger system，而不是 attention kernel
- task/trigger system 可以把未来命中的结果重新翻译为 committed attention items，仍然保持 attention-first

替代方案：

- 在 LoopBus 内核里继续加更多 wake heuristic
  - 缺点：内核持续膨胀，而且越写越像业务调度器

### 3. 重新激活的统一入口仍然是 committed attention items

理由：

- 这样未来 browser / os / scheduler / reminder 等 system 都能统一接入
- AI 看到的仍然是 attention，而不是 task system 的私有内部状态

替代方案：

- 让 trigger 直接调用模型
  - 缺点：绕开 attention truth，破坏统一运行时法则

### 4. AI 可以在“已成功委托 trigger”后收尾当前 attention

理由：

- 当前 obligation 已经从“现在要立刻完成”转变成“未来某条件满足时再做”
- 如果还保留当前 debt 不收尾，就会让 runtime 继续围绕同一 obligation 空转
- 真正的未来工作应由 trigger fire 后的新 attention item 表达

替代方案：

- 当前 debt 一直保持 active，直到未来 trigger 触发
  - 缺点：会让 runtime 把 deferred plan 和 current obligation 混成一件事

### 5. containment 保留为观察事实，不再默认兼任 wake scheduler

理由：

- no-progress / retry-count / nextWakeAt 这类 containment 数据对 Devtools 和故障分析仍然有价值
- 但这些数据是否真的触发下一轮，应该由 trigger/task layer 明确决定，而不是让 LoopBus 内核隐式定时重跑
- 这样可以保留观测面，而不继续把运行时写成半个 planner

替代方案：

- 直接删除所有 containment 数据
  - 缺点：会损失真实 AI 调试时的重要失败事实，且无法解释“为什么当前没有继续跑”

## Risks / Trade-offs

- [Risk] 去掉内建 attention debt 自动唤醒后，某些当前依赖自唤醒的 flow 会暂时失去推进能力
  - Mitigation: 在实施 change 时同步引入最小可用 trigger/task bridge，并补真实 AI regression

- [Risk] AI 可能在“委托 trigger”后错误地过早收尾 attention
  - Mitigation: 由 task/trigger skill 明确说明何时才算“委托成功”，并要求成功写入 trigger 后才能 commit done

- [Risk] 未来 trigger system 过于强大，反而变成第二套 runtime
  - Mitigation: 保持单一法则，trigger system 只负责 future wake orchestration，不直接替代 attention/runtime truth

## Migration Plan

1. 先修改 scheduling spec，明确 `score > 0` 不再自动构成 wake cause
2. 记录并改写当前 runtime 里的三个核心 touchpoint：`resolveLoopWaitingReason()`、`waitForAnyInput()`、主循环 `attentionDebtTimer` 逻辑
3. 引入最小 task-trigger capability spec，定义 trigger fire -> attention commit 的桥接 law
4. 在实现层逐步移除 session runtime 对 attention debt timer 的默认依赖，同时保留 containment 作为观察事实
5. 用真实 AI regression 覆盖：
   - 立即交付型任务不再因 residual debt 空转
   - defer-to-future 型任务能通过 trigger fire 重新唤醒

## Open Questions

- future task trigger 的最小数据模型是什么：cron-like、event hook、还是统一 predicate trigger？
- trigger fire 后提交一条 attention item 还是一组 attention items？
- task system 是否需要自己的 failure/backoff 语义，还是直接复用 attention containment？
