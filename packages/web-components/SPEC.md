# @agenter/web-components SPEC

> 本文档只记录 `@agenter/web-components` 的长期职责与 durable contract。

## 1. 包职责

- `@agenter/web-components` 提供 framework-agnostic 的 durable UI atoms。
- 这些 atoms 负责行为、结构、最小 fallback 可视性，不负责把某个产品的完整皮肤硬编码进实现。

## 2. Lit 样式契约

- 只要 Lit atom 拥有可见的内部 surface，并且下游客户端可能需要定制其皮肤，就必须暴露稳定的 `css-part` 槽位。
- 下游客户端必须通过 `::part(...)` 或 Tailwind 的 part selector 语法去做主题化，禁止依赖 shadow-private class name。
- 如果外部需要基于组件状态做 `::part(...)` 样式分支，组件宿主必须反射对应的事实状态；不能把状态只藏在 shadow child 的 `data-*` 上。
- 组件内部保留最小 fallback 样式，确保脱离产品皮肤时仍然可读；更强的品牌/产品样式属于外部客户端。

## 3. HelpHint contract

- `HelpHint` 的可定制 surface 至少包括 trigger 和 popup，并通过稳定 `part` 名称暴露。
- `HelpHint` 的宿主必须反射 presentation fact，至少覆盖 `closed`、`passive-auto`、`active-open`，供外部 `::part(...)` 主题规则使用。
