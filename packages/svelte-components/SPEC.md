# @agenter/svelte-components SPEC

> 本文档只记录 `@agenter/svelte-components` 的长期职责与 durable contract。

## 1. 包职责

- `@agenter/svelte-components` 提供 Svelte-only 的 durable structural primitives。
- 这些 primitives 负责滚动所有权、stretch/shrink 布局法则、slot 级结构语义。
- 它不负责产品级 feature surface，不负责 Lit custom element，不负责业务状态机。

## 2. Scroll ownership contract

- `ScrollView` 是标准 surface 的共享滚动所有权 durable primitive。
- `BottomAnchoredTimeline` 是 dense conversation / timeline surface 的专用 durable primitive：它把视觉底部映射为 `scrollTop = 0`，并在 primitive 边界承担 reverse-flow virtualization、visual-top older-page slot 与 latest-anchor 语义。
- 任何需要滚动的 Svelte surface，都应通过 `ScrollView` 或 `BottomAnchoredTimeline` 表达 scroll owner，而不是在 feature 层重新声明 raw scroll overflow。
- 会话、Heartbeat、room transcript 这类“latest-first but chronologically rendered”的 surface，必须优先复用 `BottomAnchoredTimeline`，不得在 feature 层重新发明 `scrollHeight/scrollTop + RAF + prepend anchor` 粘底数学。

## 3. Scaffold family contract

- `Scaffold` / `DialogScaffold` / `SplitView` 负责结构与 sizing，不负责业务数据。
- 这些 primitives 的内部 shrink/stretch law 必须绑定到不可被外部 slot 覆盖的内部 hook，而不是把 `data-slot` 当作内部样式真源。
- `DialogScaffold` 只表达 dialog 内部布局，不包含 dialog open/close 状态机，也不绑定某个 UI 框架的 close affordance。

## 4. Workbench split-detail contract

- `WorkbenchSplitDetail` 是共享的 stateful structural primitive，负责 `main + right detail` 的 ratio、resize handle、LTR clamp 与 compact-collapse 法则。
- `WorkbenchSplitDetail` 的 desktop ratio 是百分比语义，不是像素语义；窗口变宽或变窄时，应保持 left-share intent，并只在 minimum clamp 处受限。
- `WorkbenchSplitDetail` 的 compact fallback 只能从容器宽度与 `leftMin + handle + rightMin` 推导；消费者不得在 feature 层重新用 viewport breakpoint 决定 split vs sheet。
- `WorkbenchSplitDetail` 只负责布局与 persistence contract，不负责产品级 toolbar、sheet header、或 detail-local action 语义。
- string-key persistence 默认走包内提供的 global ratio source：IndexedDB 持久化 + `BroadcastChannel` 跨窗口同步；需要隔离时，消费者必须通过自定义 provider 覆盖，而不是 fork primitive。
