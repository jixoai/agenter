# @agenter/attention-system SPEC

> 本文件只记录 `@agenter/attention-system` 的长期职责与 durable contract。

## 1. 角色

`@agenter/attention-system` 是 attention truth 的独立 owner：

- 拥有 `AttentionContext` / `AttentionItem` 的 durable state
- 拥有 attention commit 的 apply / preserve / score / focus-state law
- 拥有 cold-start recovery 所需的 snapshot persistence
- 对外提供独立的 attention ingress/control-plane contract

它不是：

- message / terminal / task / receipt / timer 的 owner
- room-visible side effect 的 owner
- SessionRuntime 私有实现细节

## 2. 长期法则

- AttentionSystem 只围绕 `AttentionContext` 与 `AttentionItem` 建模，不吸收外部系统自身的定时器、receipt、watch、queue 等内部语义作为 attention 本体。
- external system 可以通过 attention-owned control plane 提交 durable attention truth，即使对应 `SessionRuntime` 尚未启动或已经停止。
- 所有 attention 写路径都必须共享同一套 context mutation law：`preserve` 只能追加/detail history 与 score/head 变化，`apply` 才能改写当前 context content。
- durable attention truth 的恢复不依赖 source replay；cold start 必须可以直接从 attention snapshot 恢复 active contexts、history、score projection、focus state。
- AttentionSystem 可以暴露独立 inspection/query surface；inspection 不应依赖某个 runtime 先在线才看得到 attention truth。

## 3. 与 Runtime 的边界

- `SessionRuntime` 是 attention consumer / scheduler / orchestrator，不是唯一 durable writer。
- runtime 可以在 live boundary 内把 adapter ingress 转换成 attention commits，但这只是 attention 写入口之一，而不是 attention durability 的本体。
- runtime 停止后，attention truth 仍应可被外部系统追加、被 inspection 读取，并在 runtime 下次冷启动时被恢复。
