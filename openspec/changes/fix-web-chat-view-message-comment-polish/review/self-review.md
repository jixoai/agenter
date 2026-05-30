# Self Review: Web Chat Message Comment Polish

## 结论

本轮实现和证据与原始目标基本对齐，可以进入用户验收。核心问题已经收口：`Trusted bootstrap` 不再作为正常发送者名泄漏；app-view room mode 可以拿到自包含的 sender/avatar directory；空评论不会渲染成 `No comment body yet`；评论图标统一为 `MessageSquareDot`；评论/source 面板动作改成 icon affordance；Framework7 `PageContent` 的 padding offset 所有权恢复给 Framework7。Round 2 验收反馈也已收口：source popup 不再出现双重 `.page-content`，有图标的 dense toolbar 不再显示 `Actions` / `Comment` 文案，空评论保存会自动删除临时 anchor 或 pending comment resource。Round 3 反馈也已收口：空评论保存、关闭/取消、Framework7 `onSheetClosed` 都走同一个删除并关闭语义；comment edit Sheet 不再用 Web Chat 自定义 translucent/blur chrome 重绘官方 Sheet/Toolbar 外观。

## 对齐清单

- 发送者显示：Web Chat 优先使用 `senderContactId` 对应的 canonical actor presentation，`from` 和 bootstrap/grant label 只作为兜底。
- 头像来源：daemon snapshot 返回 `actorDirectory`，app-view 自己通过后端投影拿 label/iconUrl，不依赖 Studio store 或 iframe event bridge。
- 评论资源：空 `commentText` 会在 normalize/extract 阶段被丢弃，source popup 和 comment inspector 不再显示 `No comment body yet`。
- 评论图标：comment anchor、comment inspector、resource card、preview layer 都使用 `MessageSquareDot`。
- 动作按钮：source/comment panel 的主要 actions 使用图标按钮并保留 `aria-label/title`，不再用裸文字作为主动作 UI。
- 气泡 padding：移除了 `.message-card-with-actions` 的无条件 `padding-inline-end`，不再让左右气泡都吃同一侧预留。
- Framework7 padding：`.message-source-comment-editor-content.page-content`、`.comment-inspector-edit-content.page-content`、`.message-source-page-content.page-content`、`.resource-preview-shell-page-content.page-content` 不再写 whole `padding` / `padding-bottom` 覆盖 Framework7 公式。
- Framework7 shell：`message-source-page` 与 `resource-preview-shell-page` 手写 `PageContent`，所以对应 `Page` 已设置 `pageContent={false}`，避免 Framework7 自动再包一层 `.page-content`。
- Source toolbar：`Open source line actions` 与 `Comment on selected source line` 只保留 icon 可见内容，文字只保留在 `aria-label/title` 中。
- 空评论删除：source popup 空保存会删除临时 comment anchor；pending comment resource 清空后保存会移除该 resource。
- 空评论关闭：source comment editor 的保存、取消、Sheet closed 都走 `finalizeEmptyCommentEditor`；pending comment preview 的保存、关闭、preview close 都走 `finalizePendingCommentEdit`，空内容会删除并关闭，不再留下打开面板。
- Framework7 Sheet 风格：source/comment edit sheet 保留直接 `Sheet -> Toolbar -> PageContent` 拓扑，移除了 `.sheet-modal` / `.toolbar` 上的自定义 background、backdrop-filter、transparent toolbar 变量覆盖，让官方 Sheet chrome 重新成为视觉来源。

## 证据

- OpenSpec apply commit-check：通过，且 spec commit `27100334 docs(spec): plan web chat message comment polish` 已独立存在。
- OpenSpec self-review commit-check：通过，最新实现提交为 `69244435 fix: polish web chat message comments`。
- `bun run --filter '@agenter/web-chat-view' typecheck`：Round 3 复跑通过，0 errors / 0 warnings。
- `bun run --filter '@agenter/web-chat-view-example' typecheck`：通过，0 errors / 0 warnings。
- `bun run --filter '@agenter/web-chat-view' test:unit -- test/comment-resource-contract.test.ts test/comment-resource-reopen-contract.test.ts test/message-row-layout.test.ts test/message-source-popup-layout.test.ts test/web-chat-view.test.ts`：Round 3 复跑通过，5 files / 51 tests passed。
- `cd packages/web-chat-view/example && bun run test -- test/review-room-actor-directory-contract.test.ts`：1 file / 2 tests passed。
- `bun run --filter '@agenter/cli' test -- --grep "app-view room mode"`：1 test passed。
- `bun run openspec:vision -- validate fix-web-chat-view-message-comment-polish`：valid。
- Round 3 BDD red/green：新增的 empty finalizer contract 与 official Sheet chrome contract 先失败，随后实现后通过。
- `agent-browser` route screenshots：desktop transcript/source/comment editor、iPhone 14 list/transcript/source/comment editor、Studio embedded desktop。
- CSS measurement：desktop/iPhone 14 JSON 都显示 comment editor textarea 在 viewport 内，`visibleText` 为 `no-placeholder`。
- CSS rule evidence：浏览器 CSSOM 记录 Framework7 `.page-content` 仍通过 `padding-top/padding-bottom` 公式和 `--f7-page-*` / `--f7-page-content-extra-padding-*` 变量计算 offset。
- Round 2 browser evidence：`round2-iphone14-source-popup-contract.json` 显示 `nestedSourcePageContent=false`、`ancestorPageContentCount=1`、toolbar `text=""` 但 `ariaLabel/title` 保留，空评论 anchor 数量 `0 -> 1 -> 0`。
- Round 2 screenshots：`round2-iphone14-source-popup.png` 与 `round2-iphone14-empty-comment-after-save.png` 已保存。

## 偏移清单

- 流程偏移：OpenSpec 要求 apply commit-check 在产品代码前运行。本上下文接手时产品代码已经作为未提交改动存在；本轮没有回滚重做，而是重新跑了 apply commit-check、逐项复核、补修、验证，并在 tasks 中记录偏移。
- 证据偏移：用户当前 Studio 房间是空房间，无法覆盖发送者/头像/评论/source popup 场景。本轮保留了 Studio iframe 嵌入截图，同时启动当前 worktree 的稳定 web-chat-view example harness 做完整视觉证据。
- 操作偏移：移动端 `agent-browser click @e31` 被 overlay 拦截。后续改为在页面内找到同一个 `aria-label="Comment on selected source line"` 元素并调用真实 click 事件，触发的是同一组件事件链。
- 范围偏移：没有清理所有 `env(safe-area-inset-*)`。本轮只清理会覆盖 Framework7 `PageContent` / toolbar offset 的冲突点；保留了 composer sheet、preview body、toolbar inner、profile surface 等 inner-shell spacing 用法。
- 验证偏移：没有运行完整 `@agenter/web-chat-view` Storybook DOM 套件；本轮用 targeted unit/typecheck、CLI contract、example contract、真实 route screenshot 和 CSSOM 证据收口。
- 工作区偏移：`bun.lock` 保持 dirty 且未提交，因为它包含无关 terminal / backup package 变化，不属于本 change。
- Round 2 验证偏移：第一次 Playwright 脚本从仓库根运行时找不到 `playwright`，因为依赖在 `packages/web-chat-view`；后续从包目录重跑通过。
- Round 2 验证偏移：两次移动端浏览器脚本等待 `[part="message-bubble"]` 超时，根因是 `part` 是 token 列表，实际需要 `[part~="message-bubble"]`；修正选择器后通过。
- Round 3 视觉偏移：本轮没有重新拍浏览器截图，只做了 Framework7 source contract、targeted unit 和 typecheck。原因是用户这轮指出的是可由源码契约稳定覆盖的生命周期和官方 chrome ownership；若要确认最终观感，下一步仍建议在用户正在运行的 Studio/app-view 中目测 Sheet。

## 未来任务清单

- 把 remaining `env(safe-area-inset-*)` 用法整理成一个小型 visual-law audit，逐个确认是 inner-shell spacing 还是 Framework7-owned surface。
- 给 comment/source popup 增加一个 Storybook DOM contract，用真实浏览器覆盖“打开 source -> 新建 comment -> 保存 -> reopen comment preview”的全流程。
- 未来如果要给非空 comment 删除按钮，应把它作为明确 destructive icon action 加到 preview/edit controls，并在有内容时弹确认框；本轮只实现用户建议的空保存自动删除。
- 对所有 Web Chat `Sheet` 做一次官方 Framework7 chrome audit。Round 3 只修了 comment edit 相关两个 Sheet；example/review shell 里其它 Sheet 如果仍有自定义外观，需要逐个判断是产品授权还是历史残留。
- 考虑把 actor presentation projection 从 CLI plain endpoint 进一步沉淀为长期 message-system/app-server API contract，避免未来另一个 host 重复实现目录投影。
- 如果要彻底统一头像组件，可以把 `ChatAvatar` 与 Studio/Auth profile avatar 的样式 token/尺寸契约沉淀到 shared avatar primitive。
- 等用户验收视觉效果后，再 archive `fix-web-chat-view-message-comment-polish`，不要现在直接 archive。
