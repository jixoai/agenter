## Context

当前 runtime 配置存在两个混淆层：

1. `ai.providers.*` 既承载 provider registry，又被 Heartbeat 面板当成当前 runtime knobs 的写入位置。
2. scoped settings graph 虽然已经能解析 avatar settings 文件，但编辑层选择和 provenance jump target 仍然优先把普通 file layer 当成唯一可编辑目标。

这让 Heartbeat 的“下一次 call 配置”与 Settings graph 的 durable truth 脱节。用户在 Avatar 的 Heartbeat 面板里调 thinking 或 temperature，预期应该是写到 `~/.agenter/avatar/<name>/settings.json`，而不是改 provider 默认值。

## Goals / Non-Goals

**Goals:**
- 让 Heartbeat AI Config 面板把 runtime knobs 写到 avatar durable settings 层。
- 让 runtime 解析阶段从根级 `ai.*` 读取 runtime knobs，而 provider registry 只保留 provider 默认配置。
- 让 scoped settings graph 把 avatar layer 视为一等编辑目标和 jump target。
- 用 focused tests 锁定 settings merge、session config、settings scope、Heartbeat config serialization 的新法则。

**Non-Goals:**
- 不重做整个 runtime settings UI。
- 不引入新的 provider schema 或新的 settings source 类型。
- 不改动 provider registry 的基础字段，如 `model`、`baseUrl`、`apiKeyEnv`。

## Decisions

### 1. Runtime knobs 归到根级 `ai.*`

`temperature`、`topK`、`maxToken`、`thinking` 属于“当前 active provider 的 runtime execution knobs”，不是 provider registry identity 的一部分。因此它们必须位于根级 `ai.*`，并由当前 active provider 消费。

Alternative considered:
- 继续把 knobs 放在 `ai.providers.<active>.…`
  - Rejected，因为这会把“provider 默认值”和“当前 runtime 覆写”混成同一层，破坏 durable layering。

### 2. Heartbeat 配置优先写 avatar editable layer

Heartbeat 面板来自 Avatar runtime surface，因此默认写入目标必须优先是 `user:avatar` 或 `kind=avatar` 的 editable layer；只有在 avatar layer 缺失时才退回普通 editable file layer。

Alternative considered:
- 直接写第一个 editable layer
  - Rejected，因为全局 `settings.json` 容易抢占写入目标，导致 Avatar 级配置无法客观落盘。

### 3. scoped settings jump target 把 avatar layer 视为 file-equivalent editable source

从 provenance 的角度，avatar settings 文件与普通 file layer 一样都是本地 durable source。jump target 选择必须允许 `kind=avatar` 参与 editable target 和 fallback target 的解析。

Alternative considered:
- 只在 Heartbeat 面板局部硬编码 avatar layer id
  - Rejected，因为这会把 UI patch 建在错误平台法则上，settings graph 仍然不完整。

## Risks / Trade-offs

- [Risk] 历史 settings 文件仍可能保留旧的 provider-level knobs。 → Mitigation: 当前解析路径优先使用根级 `ai.*`；旧 provider fields 不再由 Heartbeat 写入，后续如需清理再做专门迁移。
- [Risk] 某些只依赖 provider schema 的调用点可能忘记切换到根级 `ai.*`。 → Mitigation: 补 session config、semantic judge 和 settings loader 的 focused tests。
- [Risk] avatar layer 缺失时的回退选择仍可能让用户困惑。 → Mitigation: 保持“avatar 优先，其次 editable file layer”的 deterministic 规则，并通过 settings graph 暴露真实 sourceId。

## Migration Plan

1. 更新 delta spec，声明 Heartbeat config save 的 durable contract。
2. 调整 settings schema / loader / session config，让 runtime knobs 统一从根级 `ai.*` 读取。
3. 调整 settings scope 与 Heartbeat config state，让 avatar layer 成为默认编辑目标。
4. 运行 focused tests。
5. archive change，并同步主 spec。

## Open Questions

- 是否要在未来单独做一次 settings migration，把历史 `ai.providers.*` 下残留的 runtime knobs 自动提升到根级 `ai.*`。
