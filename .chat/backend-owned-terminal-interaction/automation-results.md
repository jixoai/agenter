# backend-owned-terminal-interaction 自动化验证记录

本文件记录本 change 的自动化验证结果。人工原生验收看同目录的 `native-manual-acceptance.md`。

## 已运行

- `openspec validate backend-owned-terminal-interaction --strict`
  - 结果：通过
  - 说明：OpenSpec change 当前结构有效。
- `bun test packages/cli-shell/test/cli-shell-tui.test.ts --timeout 120000`
  - 结果：通过
  - 证据：`57 pass / 0 fail`
  - 覆盖重点：OpenTUI 投影不再拥有本地 selected text、shell/dialogue owner 路由、backend overlay 跟随滚动、copy 请求、cursor-follow、Option 跳词、debug filter。
- `bun test packages/cli-shell/test/live-terminal-mirror.test.ts --timeout 120000`
  - 结果：通过
  - 证据：`19 pass / 0 fail`
  - 覆盖重点：dirty signal + client-paced pull、默认 30FPS、followCursor 只发后端 follow 请求、不回退成本地 viewportTarget、滚动输入只客观转发。
- `bun test packages/terminal-transport-protocol/test/terminal-transport-protocol.test.ts --timeout 20000`
  - 结果：通过
  - 证据：`12 pass / 0 fail`
  - 覆盖重点：语义交互消息、selection overlay frame payload、row-cache、same-process direct data plane。
- `bun test packages/termless-core/test/terminal-interaction.test.ts packages/termless-core/test/backend-factory.test.ts --timeout 30000`
  - 结果：通过
  - 证据：`6 pass / 0 fail`
  - 覆盖重点：backend-owned capability facts、generic adapter 的 CJK/emoji/wrapped selection、range/viewport lines API。
- `bun test packages/ghostty-native/test/terminal-interaction.test.ts --timeout 30000`
  - 结果：通过
  - 证据：`3 pass / 0 fail`
  - 覆盖重点：Ghostty selectionString、selection 跟随 scrollback、native word/line selection API。
- `bun test packages/terminal-system/test/control-plane.test.ts --timeout 120000`
  - 结果：通过
  - 证据：`62 pass / 0 fail`
  - 覆盖重点：control-plane 语义交互、copy selection 返回、followCursor 后端决策并按 attachment pull 高度投影。
- `bun run --filter '@agenter/cli-shell' typecheck`
  - 结果：通过
- `bun run --filter '@agenter/terminal-system' typecheck`
  - 结果：通过
- `bun run --filter '@agenter/terminal-transport-protocol' typecheck`
  - 结果：通过
- `git diff --check`
  - 结果：通过
- `openspec validate backend-owned-terminal-interaction --strict`
  - 结果：通过

## 待运行

无。

## 人工-only 缺口

- Ghostty.app 原生视觉体验仍需要人工走查：中文宽度、拖选视觉、硬件光标、滚动条手感。
- 原生系统剪贴板行为仍需要人工走查：`⌘C`、`Ctrl+Shift+C`、文本粘贴、图片粘贴 unsupported 状态。
