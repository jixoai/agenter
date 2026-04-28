## Context

第一阶段可以在现有法则下补 recovery surface，但底层语义仍然错误：

1. provider `maxRetries` 只适用于单次模型请求 transport retry，却被误读成 Heartbeat/session runtime 的持续 recovery policy。
2. compact trigger 仍然部分挂靠 provider `compactThreshold` 与 `Any-Error => compact` 这种错误启发式，而不是 explicit runtime compact law。
3. runtime containment/backoff 仍然依赖内核中的内建函数与隐含 budget，而不是 durable settings truth。
4. WebUI 无法在 Settings 中客观编辑 recovery law，因为当前 schema 没有这个概念。

要解决这些问题，必须做一次破坏性更新：把 transport retry、runtime retry policy、runtime compact policy 变成三个正交原子，分别归属于 provider transport contract 与 runtime scheduler contract。

## Goals / Non-Goals

**Goals:**
- 把 provider transport retry 与 runtime recovery/backoff policy 从 schema、resolved config、kernel、WebUI 上彻底拆开。
- 为 runtime 引入 durable、可验证、可发布、可编辑的 structured retry policy 与 compact policy。
- 让 runtime Settings surface 成为 durable recovery policy 的唯一编辑面。
- 保持 Heartbeat quick config 继续只服务 next-call execution knobs。

**Non-Goals:**
- 不在这个 change 中重做 Heartbeat transcript 的 message-part 模型。
- 不把 provider 计价、缓存命中计费等估算问题并入 retry policy change。
- 不把“表达式字符串”直接作为 durable retry truth。

## Decisions

### 1. 明确拆分两类 retry 语义

第二阶段将 retry 拆成两套契约：

- provider transport retry
  - 作用域：单次模型请求
  - 用途：HTTP / SDK 层重试
- runtime retry policy
  - 作用域：session scheduler / Heartbeat recovery
  - 用途：attempt progression、delay、blocked/backoff、reset semantics

Alternative considered:
- 继续保留 `maxRetries` 并通过文档解释两种语义
  - Rejected，因为这会继续制造双重语义字段，平台法则仍然是错的。

### 2. Runtime retry policy 采用 structured policy，而不是 opaque expression string

用户视角上可以希望“第 N 次失败等待多久”像表达式一样灵活，但 durable truth 不应直接存成无法静态校验的字符串表达式。第二阶段优先采用结构化 policy，例如：

- policy mode（如 `exponential`、`steps`）
- attempt / max-attempt boundaries
- delay parameters
- reset conditions

未来如果要提供 expression editor，也应该只是 UI sugar，最终编译回结构化 truth。

Alternative considered:
- 直接把 `attempt => delayMs` 表达式字符串写进 settings
  - Rejected，因为它不可验证、难以做 provenance、难以跨语言实现，也会破坏 type-safe/runtime-safe 的基线。

### 3. Runtime policy 进入独立 settings 域，而 provider retry 退回 transport contract

本 change 采用以下职责边界：

- provider contract 只保留 transport retry metadata
- runtime retry / compact policy 进入独立的 scheduler/loop settings 域

这意味着 resolved session config 需要同时解析：
- provider transport settings
- runtime retry policy snapshot
- runtime compact policy snapshot

Alternative considered:
- 把 runtime retry policy 继续挂在 `ai.providers.<id>` 下面
  - Rejected，因为 provider registry 不应该承载 session scheduler law。

### 4. Compact trigger law 必须对象化，禁止 generic any-error compact

本 change 将 compact trigger 明确为 runtime compact policy，而不是继续沿用 `error` 这种泛化触发器。默认法则：

- `manual`
  - 永远允许，由 operator 显式发起
- `threshold`
  - 由 compact policy 的 threshold 配置控制
- `attention_retry`
  - 由 compact policy 的 recovery trigger 配置控制
- `context_overflow`
  - 由 compact policy 的 recovery trigger 配置控制
- `external_continuation_limit`
  - 由 compact policy 的 recovery trigger 配置控制
- `timeout`
  - 默认不触发 compact，除非 operator 显式开启

这意味着新系统不再生成泛化的 `compactTrigger=error`；旧 ledger 中的 `error` 只作为 legacy read path 被容忍。

Alternative considered:
- 继续保留 `error` 触发器，并在实现里偷偷区分 timeout/context overflow
  - Rejected，因为这会把真实 compact law 藏在代码分支里，UI 与 spec 都无法客观呈现。

### 5. Runtime Settings surface 负责 durable policy，Heartbeat quick config 不扩权

第二阶段 WebUI 将明确分层：

- `Heartbeat quick config`
  - next-call execution knobs
- `Runtime Settings`
  - provider transport
  - compact policy
  - retry policy
  - prompt / locale

Alternative considered:
- 把 retry policy 继续放在 Heartbeat quick config
  - Rejected，因为 quick config 是执行面，不是 durable policy 面。

### 6. 迁移策略采用“读旧写新”的单向过渡

虽然这是 breaking change，但迁移仍然应当是可控的：

- loader/resolver 在一个过渡窗口内读取 legacy provider `maxRetries`
- loader/resolver 在一个过渡窗口内读取 legacy provider `compactThreshold`
- 新写入路径只写新 policy / transport fields
- WebUI 和新接口只展示新语义

Alternative considered:
- 一次性完全移除 legacy read path
  - Rejected，因为这会让已有 settings 文件瞬间失效，破坏升级稳定性。

## Risks / Trade-offs

- [Risk] structured retry policy 会比单个整数更复杂。 → Mitigation: 提供 default policy、清晰 section、客观的 resolved snapshot。
- [Risk] transport retry、retry policy、compact policy 同时可见会让 operator 困惑。 → Mitigation: Settings 明确分区，并在 UI 文案中强调 per-request transport vs scheduler recovery vs compact trigger law。
- [Risk] 去掉 `Any-Error => compact` 可能暴露 timeout/backoff 真实等待路径。 → Mitigation: UI 发布 policy-resolved recovery state，让 operator 看到 backoff/block 的客观原因，而不是被 compact 隐藏。
- [Risk] legacy settings migration 期间可能出现新旧字段并存。 → Mitigation: 采用“读旧写新”，并通过 provenance/diagnostics 暴露实际生效字段。

## Migration Plan

1. 新增 `runtime-retry-policy` 与 compact trigger delta specs。
2. 扩展 settings schema 与 resolved session config，拆开 transport retry、runtime retry policy、runtime compact policy。
3. 更新 runtime kernel，让 containment/backoff 与 compact trigger 都从 resolved policy snapshot 计算。
4. 更新 client SDK / interfaces / WebUI runtime settings surface。
5. 通过兼容读路径完成过渡，并在后续 change 中移除 legacy alias。

## Open Questions

- expression editor 是否在后续作为 UI sugar 提供，并编译到 structured policy，而不是直接成为 durable truth。
