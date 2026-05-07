# @agenter/product-extension-runtime SPEC

> 本文件记录 `@agenter/product-extension-runtime` 的长期能力边界。

## 1. 角色

`@agenter/product-extension-runtime` 是 ordinary-user product 的平台契约包：

- 定义 product descriptor、resource binding、assistant initialization、attention projection、delegation lease 等 typed contract
- 让外部 product package 通过可编程接口消费 core capability，而不是 import core runtime internals
- 为未来 product 复用同一套 law，避免把 cli-shell 语义硬编码回 core

## 2. 长期法则

- package 只定义 generic contract，不定义具体 product grammar、terminal naming、toolbar layout、prompt wording 或 local UI state。
- product-owned assistant initialization 固定是 seed-if-missing：缺失 prompt/memory 可补齐，已有 avatar-private 文件始终是真源。
- product-owned resource binding 固定使用 `productId + resourceKey + resourceKind`，而 terminal、room、AvatarRuntime、attention 的 authority owner 仍分别属于对应 system。
- product-scoped hosting work 固定通过 attention scheduler fact 表达；`hosting` 只是受控 score key，不得被解释成隐式 terminal write authority。
- autonomous terminal mutation 必须再经过显式 delegation / lease contract；delegation 需要保留 granting actor、target Avatar、target resources、expiry、policy 与 provenance。
