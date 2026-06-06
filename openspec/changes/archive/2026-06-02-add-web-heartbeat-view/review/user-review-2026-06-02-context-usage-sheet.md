# User Review: context usage sheet polish

## User Feedback

- 大部分都验收通过了。
- 底部 Compact 按钮要换成一个“上下文用量”的展示组件，显示成 `31.3% ⭕️`。
- 点击上下文用量组件要出现一个 Modal Sheet，展示详细上下文用量，结构参考用户提供的图。
- 详情中不要展示 Cost。
- 图中底部的 Total cost 区域要改为客观展示模型名字和模型配置；当前模型配置较少，但未来会有 `effect:high|max`、`thinking:true|false` 这类配置。
- Compact 按钮要挪到这个 Modal Sheet 内，采用 icon+text，图标使用 `<Shredder />`。
- 顶部 subnavbar title 可以省掉关于“上下文用量”的信息。
- 用户做过一些样式调整，直接接受，不要回滚。

## Implementation Plan

- Keep `HeartbeatContextState` as the objective token-usage projection.
- Replace the first-level bottom compact action with a context-usage toolbar control.
- Add a Framework7 modal Sheet for context usage details and move compact into that Sheet.
- Keep the existing official compact confirm dialog before invoking the adapter compact callback.
- Remove context usage from `buildHeartbeatSubnavbarTitle`.
- Add BDD tests and mobile agent-browser evidence before reporting completion.
