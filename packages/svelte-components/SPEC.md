# @agenter/svelte-components SPEC

> 本文档只记录 `@agenter/svelte-components` 的长期职责与 durable contract。

## 1. 包职责

- `@agenter/svelte-components` 提供 Svelte-only 的 durable structural primitives。
- 这些 primitives 负责滚动所有权、stretch/shrink 布局法则、slot 级结构语义。
- 它不负责产品级 feature surface，不负责 Lit custom element，不负责业务状态机。

## 2. Scroll ownership contract

- `ScrollView` 是共享滚动所有权的唯一 durable primitive。
- 任何需要滚动的 Svelte surface，都应通过 `ScrollView` 表达 scroll owner，而不是在 feature 层重新声明 raw scroll overflow。

## 3. Scaffold family contract

- `Scaffold` / `DialogScaffold` / `SplitView` 负责结构与 sizing，不负责业务数据。
- 这些 primitives 的内部 shrink/stretch law 必须绑定到不可被外部 slot 覆盖的内部 hook，而不是把 `data-slot` 当作内部样式真源。
- `DialogScaffold` 只表达 dialog 内部布局，不包含 dialog open/close 状态机，也不绑定某个 UI 框架的 close affordance。
