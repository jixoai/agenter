## Context

当前 runtime 的真实问题不是缺一个 Heartbeat 字段，而是分层错位：

- `SessionRuntime` 同时承担 Kernel、System adapter、持久化桥、UI publication 四类职责
- `MessageSystem` ingress、terminal dirty invalidation、skill refresh commit 都直接触碰 attention/kernel 细节
- `read`、`attention commit`、`ai_call running`、`AI stream acceptance` 四种事实没有被建成独立层
- Heartbeat、Devtools、client store 只能从混合事实里做近似推断，导致“消息已读但 AI 尚未真正 ingest”这类错位不可避免

这次重构的核心不是修一个面板，而是先恢复平台法则：

1. Kernel 足够中立，只理解 attention ingress / dispatch / receipt / projection
2. Message / Terminal / Skill 都通过统一 adapter 接入 Kernel
3. AI delivery truth 只由 ModelClient 流边界裁定
4. 验收必须分层，不允许继续用一组端到端用例掩盖中间层语义错位

## Goals / Non-Goals

**Goals:**

- 把 `LoopBus + Attention orchestration + delivery receipt` 提炼成独立的 `loopbus-kernel` 平台层
- 彻底隔离 MessageSystem 与 Kernel，避免 MessageSystem 再直接理解 Attention/LoopBus 内部 law
- 让 TerminalSystem、RuntimeSkillSystem 和未来 System 复用同一套 adapter contract
- 建立 durable `dispatch / receipt / delivery projection` 事实层，明确区分 `read`、`commit`、`running`、`accepted`
- 将 `SessionRuntime` 收敛为 host/orchestrator，而不是继续作为“全能运行时”
- 建立可执行的分层验收矩阵和多轮 review gate，持续对照本次 change 的最初分层目标

**Non-Goals:**

- 不重写 MessageSystem 的 durable room/message schema
- 不重做 TerminalSystem 或 SkillSystem 的产品表面交互
- 不引入新的 provider 协议标准；receipt 仍基于现有 ModelClient 流解析
- 不长期保留旧 `SessionRuntime` 直连 attention/kernel 的兼容路径

## Decisions

### 1. 新建独立 `packages/loopbus-kernel`

Kernel 抽成独立 workspace package，最小依赖为：

- `@agenter/attention-system`
- 与 LoopBus/stream 相关的共享类型

Kernel 不依赖：

- `@agenter/message-system`
- `@agenter/terminal-system`
- `RuntimeSkillSystem`
- WebUI / client-sdk / router

Kernel 只负责：

- 接收中立 ingress envelope
- 生成 `AttentionCommit`
- 生成 `AttentionDispatch`
- 生成 `AttentionReceipt`
- 推导 `AttentionDeliveryProjection`
- 发出 kernel hooks / events

选择理由：

- 只有独立 package 才能强制执行“内核不 import 外部 System 细节”的法则
- 把 Kernel 留在 `SessionRuntime` 文件内，即使拆函数，也会继续在工程上容忍回流耦合

备选方案：

- 先在 `SessionRuntime` 内部分模块，后续再抽包
  - Rejected，因为这会继续允许 source-specific import 和临时回调，不能从工程结构上阻止回归

### 2. 所有外部 System 一律走 adapter contract

新增 `runtime-system-kernel-adapters` 契约。Message、Terminal、Skill 都必须实现统一接口：

- `mount(host)`
- `bootstrap()`
- `drainIngress()`
- `onKernelEvent(event)`

统一 ingress envelope 至少包含：

- `system`
- `sourceId`
- `contextKey`
- `kind`
- `summary`
- `content`
- `format`
- `score`
- `tags`
- `createdAt`
- `meta`

adapter 允许保留本系统的内部行为，比如：

- MessageSystem 自己处理 read ack
- RuntimeSkillSystem 自己处理 watcher/refresh
- Terminal adapter 自己决定 dirty snapshot 的 summary/detail 呈现

但 adapter 不允许：

- 直接 `attentionSystem.commit(...)`
- 直接构造 LoopBus internal message
- 直接宣布 AI delivery success

选择理由：

- 用户明确要求先完全隔离 MessageSystem 与 Kernel
- 如果只为 MessageSystem 特判，Terminal/Skill 很快又会复制同样的问题

备选方案：

- 先做 message adapter，其它系统维持旧路径
  - Rejected，因为这会制造“双法则期”，削弱本次 change 的长期收益

### 3. 建立三层事实：Commit / Dispatch / Receipt

保留 `AttentionCommit` 作为 obligation truth，不向其中塞 delivery 字段。

新增两组 durable facts：

- `AttentionDispatchRecord`
- `AttentionReceiptRecord`

投影层再根据它们推导：

- `AttentionDeliveryProjection`

状态机固定为：

- `pending`
- `dispatching`
- `accepted`
- `errored`
- `aborted`
- `completed`

语义固定：

- `pending`: 已 commit，尚未被某次 attempt 选中
- `dispatching`: 已选中并准备发给 AI，尚未拿到首个有效 SSE
- `accepted`: 收到首个非 error 的有效 SSE
- `errored`: 首帧 error 或建流失败
- `aborted`: 控制面或 transport 中止
- `completed`: `run_finished`

选择理由：

- 这能把 “系统看到了消息” 和 “AI 真正接到了消息” 拆成两个平台事实
- 也能支持多 attempt 历史，而不是让一次失败覆盖整个 commit

备选方案：

- 给 `AttentionCommit` 添加 `deliveryState`
  - Rejected，因为 commit 是义务事实，不应退化成 mutable delivery snapshot
- 用 `ai_call.status` 直接表达 acceptance
  - Rejected，因为 `running` 早于首个有效 SSE，语义天生过粗

### 4. ModelClient 是唯一 receipt 判官

`accepted` 必须由 `ModelClient` 在流式 chunk 边界判定，而不是由 `SessionRuntime.handleModelCall(status="running")` 判定。

固定规则：

- 第一条非 error 的有效 SSE -> `accepted`
- 第一条即 `RUN_ERROR` 或 transport/build-stream error -> `errored`
- `RUN_FINISHED` -> `completed`
- abort/cancel/stop -> `aborted`

`sessionModelCallId` 允许晚绑定：

- dispatch 创建时先用逻辑 `agentCallId`
- `ai_call` ledger row 落库后再回填 `sessionModelCallId`

选择理由：

- 只有 ModelClient 真的看到了 provider stream 的语义边界
- 如果继续用 `running` 近似 acceptance，就会把旧问题重新包装一遍

备选方案：

- 用 HTTP request started 作为 acceptance
  - Rejected，因为 provider 可能在开流后立刻回 error SSE
- 用 `cycleDidCallModel` 作为 acceptance
  - Rejected，因为那是整轮结束态，不是 ingress receipt

### 5. `SessionRuntime` 退化为 host / bridge

重构后 `SessionRuntime` 只负责：

- 创建 kernel
- 注册 adapters
- 管理 session.db / websocket / trpc publication
- 将 `agentCallId` 绑定到 `sessionModelCallId`
- 将 kernel state 投影到 Heartbeat / Devtools / runtime local API

`SessionRuntime` 不再负责：

- message/terminal/skill -> attention 的手写翻译
- lifecycle attention 直写
- receipt 语义裁决
- 直接组装“系统特化的 attention glue”

选择理由：

- Host 层与 Kernel 层混在一起，会持续放大心智负担
- 让 `SessionRuntime` 瘦身后，测试和 review 才能按层次推进

备选方案：

- 保留 `SessionRuntime` 作为 implementation host，但通过约定不新增 glue
  - Rejected，因为约定无法替代物理结构隔离

### 6. 验收和 review 也必须分层

这次 change 的 acceptance 不以“跑通一个 e2e”作为唯一结论，而是固定四层：

1. Kernel unit
2. Adapter integration
3. Runtime orchestration integration
4. Client/WebUI projection contract

同时引入四个 review gate：

- Gate A: OpenSpec review
  - proposal/design/specs/tasks 是否把分层和 acceptance 写清楚
- Gate B: Kernel review
  - Kernel 是否仍然中立、无 system import、state machine 是否正确
- Gate C: Adapter review
  - Message/Terminal/Skill 是否彻底经由 adapter，而不是留下 runtime 直连后门
- Gate D: Projection review
  - Heartbeat/Devtools/UI 是否只消费 delivery truth，而不再偷用 read/running

选择理由：

- 用户明确要求“多轮迭代 review，确保效果与最初目标保持一致”
- 如果 review 只看最终 UI，很容易在中途引入新的层次污染而不自知

## Risks / Trade-offs

- [Risk] 改动范围跨越 `app-server / client-sdk / webui / openspec`，短期内编译和测试会同时失效。  
  → Mitigation: 先落 OpenSpec 和 kernel types，再按 `kernel -> adapters -> host -> projections` 顺序分批提交，通过分层测试逐步恢复。

- [Risk] `SessionRuntime` 里现有大量 attention glue 迁移时可能出现遗漏。  
  → Mitigation: 在 tasks 中显式列出所有待迁移入口，包括 message ingress、terminal lifecycle、skill refresh、heartbeat publication、ai_call binding。

- [Risk] receipt 历史和 ai_call ledger 关系复杂，容易再次混用。  
  → Mitigation: 明确 `agentCallId` 与 `sessionModelCallId` 双标识模型，并把 “running != accepted” 写进 spec 和测试。

- [Risk] 大重构容易为了过渡方便而保留长期兼容胶水。  
  → Mitigation: 明确禁止长期双轨路径；允许同一分支内短暂 shim，但最终合并前必须删掉旧直连入口。

- [Risk] adapter 抽象过度会掩盖系统个性。  
  → Mitigation: 统一的是 ingress/delivery interface，不是 presentation/detail 生成；各 system 仍保留自己的 domain formatting。

## Migration Plan

1. 创建并评审本次 OpenSpec change，先锁定 capability、分层边界、acceptance matrix、review gate。
2. 新建 `packages/loopbus-kernel`，先落 types、store、hooks、dispatch/receipt state machine 和 kernel 单测。
3. 在 `app-server` 中新增 runtime adapters 目录，先实现 Message adapter，再补 Terminal 和 Skill adapter。
4. 将 `AgenterAI + ModelClient` 接入新的 dispatch/receipt API，并完成 `agentCallId -> sessionModelCallId` 绑定。

## Review Follow-up (2026-04-24)

后续独立 review 重新打开了本次 change，原因不是方向错误，而是两条 law 还没有完全落地：

1. `accepted` 的裁决必须完全停留在 `ModelClient` 的 provider stream 边界，host 只允许转发，不允许重新解释什么才算有效 SSE。
2. 同一个 `ai_call` 内部如果发生 provider retry，delivery ledger 必须保留独立 attempt 历史，而不是把失败 attempt 压扁成最后一个 dispatch 的附属细节。
3. `ModelClient` 的 preflight / build boundary 也必须产出 terminal receipt；missing credential、uncallable provider、以及 provider 侧 credential rejection 都属于 delivery error，而不是 fallback assistant text。

这轮 follow-up 之后，验收额外固定为：

- `ModelClient` 单测必须验证每个 attempt 只有一条 terminal receipt，不允许 retry/final failure 产生重复 errored receipt。
- `ModelClient` 单测必须覆盖 missing credential / uncallable provider，并验证其以 `transport_error` terminal receipt 收敛，而不是把 dispatch 永久留在 `dispatching`。
- `AgenterAI` 单测必须验证 `onAssistantDelivery` 只是桥接，不做 host-level delivery 裁决。
- `SessionRuntime` orchestration 测试必须验证 internal retry 仍然聚合在同一个 `sessionModelCallId` 下，但保留独立 attempt timeline。
- real-AI 报告必须继续证明 live runtime 中 `accepted != read != ai_call.running`，并记录浏览器 Heartbeat 走查是否真实闭环。
5. 将 `SessionRuntime` 改造成 host/orchestrator，删除 message/terminal/skill 直连 attention 的旧 glue。
6. 更新 router、websocket、client runtime store、Heartbeat、Devtools，使其全部消费 delivery projection。
7. 跑完整的分层验收，并按 Gate A-D 做一轮 review；若任一 gate 发现目标漂移，先修 OpenSpec 或结构，再继续实现。

回滚策略：

- 开发过程中允许在 feature branch 内保留短期 shim 以保持编译通过
- 合并前必须删除 shim，并以新 kernel path 为唯一 truth

## Acceptance & Review Matrix

### Gate A: OpenSpec Review

- proposal 明确列出新增 capability 与修改 capability
- design 明确列出层级、数据流、migration、review gate
- specs 为每个 capability 提供可测试 requirement/scenario
- tasks 显式包含 layered acceptance 与 review 回合

### Gate B: Kernel Review

- `packages/loopbus-kernel` 不 import Message/Terminal/Skill specifics
- commit/dispatch/receipt 三层事实独立存在
- `accepted` 只来自流边界
- Kernel unit tests 覆盖状态机、attempt history、projection 推导

### Gate C: Adapter Review

- Message/Terminal/Skill 都通过统一 adapter contract 挂载
- `SessionRuntime` 内不再出现对应系统的 direct attention commit/glue 入口
- adapter integration tests 覆盖三种系统的 ingress 与 host interaction

### Gate D: Projection Review

- Heartbeat 能同时展示 `read` 与 `delivery`
- Devtools 区分 `hook outcomes` 与 `delivery receipts`
- client runtime store live patch 不再依赖 refresh 才看见 pending/receipt truth
- DOM/integration tests 覆盖 “已读但未 accepted” 与 “首帧 error” 两个关键错位场景

## Open Questions

- 无。此次 change 默认采用破坏性重构路径，不保留“继续在 SessionRuntime 内约定分层”的备选方案。
