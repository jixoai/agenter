# Self Review: Web Chat CodeMirror Resource Projection

## 结论

本轮实现与 `plans/plan.md` 对齐，可以进入用户走查。数据库与发送边界没有重新引入 `webChatCommentResources` 或其它 WebChat 结构化资源 sidecar；本轮只升级前端投影层。composer 现在仍是 writable CodeMirror，能够把 `[^Comment 1]` 这类 Markdown footnote token 投影成资源节点；message bubble 仍是 readonly CodeMirror，继续隐藏 footnote definition，并从同一资源引用解析入口渲染 inline token 与 in-bubble resource bar。

## 法则变动

- 新增共享 CodeMirror 资源 token 投影原子：`message-markdown-resource-token-projection.ts`。
- readonly bubble 的 token 解析从 bubble-only preview 实现迁移到共享原子；bubble 自己仍只负责 readonly mode policy：隐藏 definition、结构化 Markdown preview、resource bar。
- writable composer 只启用 inline token decoration，不隐藏 footnote definition/source block，避免把编辑器变成预览器。
- composer token activation 走 `WebChatResourceReference`，并接入 composer 侧 `ResourcePreviewLayer`；pending comment 仍保留空内容删除与保存语义。

## 原子产出

- `ChatDraftEditor`：接入 `markdownResourceTokenProjection(...)`，通过 refresh effect 响应资源引用变化，保留 typing、cursor、Enter submit、completion。
- `MessageMarkdownContent` / `messageMarkdownPreview`：继续 readonly，复用共享 token 解析。
- `CodeMirrorResourceProjection` Storybook story：真实挂载 `ChatDraftEditor` + `MessageMarkdownContent`，在 Chromium 中断言 writable/readonly facets、token 数量、definition 隐藏、resource bar、token open、编辑和 Enter submit。
- `resource-projection` example route：用于最终人工走查与截图，不依赖不稳定的 Storybook dev iframe。

## 证据

- OpenSpec apply commit-check：通过，latest spec commit `b583eb29 docs(spec): define web chat codemirror resource projection`。
- Before screenshots：
  - `.screenshot/before/web-chat-example-desktop-before.png`
  - `.screenshot/before/web-chat-example-iphone14-before.png`
- After screenshots：
  - `.screenshot/after/web-chat-resource-projection-desktop-after.png`
  - `.screenshot/after/web-chat-resource-projection-iphone14-after.png`
- Screenshot DOM facts：desktop/mobile 均为 `composerTokenCount=1`、`bubbleTokenCount=2`、`bubbleHasRawFootnoteDefinition=false`、`bubbleHasResourceBar=true`、`hasFrameworkOverlay=false`。
- `bun run typecheck` in `packages/web-chat-view`：0 errors / 0 warnings。
- `bun run typecheck` in `packages/web-chat-view/example`：0 errors / 0 warnings。
- `bun run test:unit -- test/message-markdown-resource-token-projection.test.ts test/message-markdown-content.test.ts`：2 files / 9 tests passed。
- `bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts`：1 file / 2 tests passed。
- `bun run openspec:vision -- validate web-chat-codemirror-resource-projection`：valid。
- `git diff --check`：通过。

## 偏移清单

- Browser 插件路径：已按 Browser skill 尝试连接 in-app browser，但当前 `agent.browsers.list()` 为空，无法使用 Browser backend；截图走查改用 Playwright，并在证据中记录。
- Svelte autofixer：`svelte_autofixer` MCP transport closed，无法作为验证入口；本轮用 `svelte-check`、unit、Storybook DOM 和真实 route screenshots 兜底。
- Storybook dev iframe：`test:dom` 的 Storybook browser path 通过；但直接打开 Storybook dev iframe 在 Bun workspace 下会被 Storybook 自身 runtime `.svelte` 文件处理卡住。本轮不扩大 Vite FS 权限，不把这个非目标问题混入实现；人工走查 URL 使用 example route。
- 截图入口：before 是现有 example root，after 是专门的 `/resource-projection` route。它们不是同一路由逐像素对比，证据用途是展示“实现前 app baseline”和“实现后目标能力可视化”。
- 视觉范围：after harness 是验证/走查 surface，不是最终产品页面；它只展示 composer writable 与 bubble readonly 的资源投影，不代表 Chat 主界面整体视觉定稿。

## 用户走查入口

- 当前 dev server：`http://127.0.0.1:6120/resource-projection`
- Storybook DOM 行为测试入口：`packages/web-chat-view/test/storybook/chat-composer-stage.stories.test.ts`

## 后续预警

- 如果未来要让 composer 内 token 与 pending resource rail 共用同一个 preview owner，应把 composer/rail 的 preview 状态提升成明确 composer-level preview law；本轮保持最小正交实现，没有重写 pending strip。
- 若后续继续依赖 Storybook dev iframe 做截图，需要单独开 change 处理 Bun workspace + Storybook Svelte runtime 的 dev-server 兼容问题。
