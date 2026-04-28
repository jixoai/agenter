## Context

目前 terminal surface 已经有了 durable terminal catalog、explicit `bootstrap / stop` 和 runtime terminal CLI，但还少两层关键 truth：

1. **transient lifecycle transition truth**
   - 为多 Avatar 并发协调服务
   - 目标是避免重复 bootstrap / kill，而不是制造新的 attention debt
2. **durable config mutation truth**
   - terminal 一旦创建，就应该能被 AI 重新检查和调整 launch truth
   - 否则 terminal 只是一次性 create payload，不是 durable collaboration asset

这两层 truth 如果继续缺席，系统只能靠 feature 层约定“最好别重复点”“最好先 list 一下”，这不是法则。

## Goals / Non-Goals

**Goals**

- 增加 terminal 过渡态，用于协调多 Avatar 生命周期冲突。
- 保持 `processPhase` 语义纯净，不把过渡态和 durable lifecycle 混在一起。
- 暴露 `terminal get-config / terminal set-config`，让 AI 能显式检查和修改 durable launch truth。
- 明确 create 的 public contract 仍然是默认 auto bootstrap。
- 明确中间态不会直接变成 terminal Attention commit。

**Non-Goals**

- 不把 lifecycle transition 持久化成新的 attention item 类型。
- 不把 `terminal set-config` 变成 live shell reconfiguration 总线。
- 不在这次 change 里新增完整的 WebUI terminal config editor。
- 不改变 `terminal create` 当前默认 auto bootstrap 的对外语义。

## Decisions

### 1. Keep `processPhase` durable and add a separate transient `lifecycleTransition`

`processPhase` 继续表示 durable process lifecycle：

- `not_started`
- `running`
- `stopped`

新增 transient coordination field：

- `lifecycleTransition: "bootstrapping" | "killing" | null`

原因：

- `bootstrapping` / `killing` 不是 durable business truth
- 它们只是“当前有 lifecycle mutation 正在执行”的协调锁
- 如果把它们塞进 `processPhase`，就会污染 stopped/running 的事实语义，并且让 attention source 更难区分“事实变化”和“协调中”

### 2. Transition truth blocks conflicting lifecycle mutations but does not create attention commits by itself

当 terminal 处于：

- `lifecycleTransition = bootstrapping`
- `lifecycleTransition = killing`

时：

- 第二个 bootstrap / stop / delete / conflicting config mutation 必须得到明确拒绝或等待提示
- 但 transition 本身不进入 terminal attention ingestion
- 也不因为“开始 bootstrap 了”就触发一个 terminal commit

原因：

- 用户已经明确要求 transition 只是并发协调状态
- 它不是“AI 需要继续处理的 terminal work item”
- terminal attention 应继续只围绕 terminal 内容变化、focus 变化、明确 lifecycle summary ingress 等 durable/semantic facts

### 3. `terminal create` keeps auto bootstrap as the public contract

当前公开 contract 已经稳定为：

- `terminal create` 默认创建并自动 bootstrap

这次 change 不推翻它。

但要补充一条更精确的 law：

- 新 terminal create 之后，调用方可能短暂观察到：
  - `processPhase = not_started`
  - `lifecycleTransition = bootstrapping`
- 一旦 bootstrap 完成，才进入：
  - `processPhase = running`
  - `lifecycleTransition = null`

这让“create 默认 auto bootstrap”和“并发协调需要中间态”同时成立。

### 4. `terminal get-config` returns durable launch truth, not inferred live truth

`terminal get-config` 应返回 terminal 的 durable config truth，例如：

- `terminalId`
- `processKind`
- `command`
- `launchCwd`
- `profile`
  - `title`
  - `icon`
  - `cols`
  - `rows`
  - `env`
  - `gitLog`
  - `logStyle`
  - `shortcuts`
  - `rendererEngine`
- `metadata`

同时返回最小必要 lifecycle summary：

- `processPhase`
- `lifecycleTransition`

但不把 `currentPath/currentTitle` 混进 config。

### 5. `terminal set-config` mutates durable launch truth; only geometry may apply live

`terminal set-config` 接受 patch 语义，而不是 whole-object replacement。

支持更新：

- `processKind`
- `command`
- `launchCwd`
- `title`
- `icon`
- `cols`
- `rows`
- `env`
- `gitLog`
- `logStyle`
- `shortcuts`
- `rendererEngine`
- `metadata`

行为法则：

- 对 running PTY：
  - `cols/rows` 可以立即 live apply，并同步持久化
  - `command/launchCwd/env/processKind/gitLog/logStyle` 只更新 durable launch truth，下一次 bootstrap 生效
  - `title/icon/shortcuts/rendererEngine/metadata` 更新投影 truth，不强行改写 live shell 内部状态
- 对 stopped/not_started PTY：
  - 直接更新 durable config，下一次 bootstrap 使用新 truth

返回值需要明确哪些字段：

- 已经持久化
- 需要下次 bootstrap 才生效

### 6. Managed terminal instances must be reconfigurable without losing durable identity

control-plane 里一旦已经创建 `ManagedTerminal` entry，后续 config 变更不能只写 DB，否则下次 bootstrap 仍会吃到旧 config。

因此 `ManagedTerminal` 需要支持 reconfigure：

- 更新下次 start 使用的 launch config
- 对 live PTY 只即时应用允许 live apply 的字段，例如 geometry

这保证：

- terminal durable identity 不变
- control-plane entry 不需要被删除重建
- running/stopped 都能共享同一条 terminal record

## Acceptance Strategy

### 1. terminal-system BDD

- prove create publishes `bootstrapping` before `running`
- prove stop publishes `killing` before `stopped`
- prove conflicting lifecycle mutations are rejected while transition is active
- prove `terminal get-config` returns durable launch truth separately from lifecycle truth
- prove `terminal set-config` updates next-bootstrap truth
- prove geometry config can also resize a running PTY

### 2. runtime / adapter BDD

- prove runtime projections expose `lifecycleTransition`
- prove terminal transition changes do not create terminal attention commits by themselves
- prove focused terminal content ingestion still works after the transition change

### 3. runtime CLI / skill BDD

- prove `terminal get-config` and `terminal set-config` are descriptor-backed commands
- prove CLI help teaches:
  - create auto bootstraps
  - stopped/not_started terminals need explicit bootstrap
  - transition means wait and reread instead of stacking another lifecycle mutation
- prove built-in terminal skill and references teach the same law

## Rejected Alternatives

### 1. Put `bootstrapping` and `killing` directly into `processPhase`

Rejected.

This mixes durable lifecycle truth with transient coordination truth and makes every consumer reconstruct which states should count as real process facts versus in-flight mutations.

### 2. Make `terminal set-config` a full-object replace surface

Rejected.

Terminal config is operational metadata with several independently useful fields. Patch semantics are better for AI and safer for incremental collaboration because callers rarely want to resend the full config object just to rename a terminal or change launch cwd.

### 3. Let transition states emit normal terminal attention commits

Rejected.

That would turn a coordination lock into cognitive debt and create exactly the wrong emergent behavior: more concurrent lifecycle work because a lifecycle mutation itself generated more AI work.
