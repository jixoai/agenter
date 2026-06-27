# Self Review: Web Chat Message Comment Polish

## 结论

本轮实现和证据与原始目标基本对齐，可以进入用户验收。核心问题已经收口：`Trusted bootstrap` 不再作为正常发送者名泄漏；app-view room mode 可以拿到自包含的 sender/avatar directory；空评论不会渲染成 `No comment body yet`；评论图标统一为 `MessageSquareDot`；评论/source 面板动作改成 icon affordance；Framework7 `PageContent` 的 padding offset 所有权恢复给 Framework7。Round 2 验收反馈也已收口：source popup 不再出现双重 `.page-content`，有图标的 dense toolbar 不再显示 `Actions` / `Comment` 文案，空评论保存会自动删除临时 anchor 或 pending comment resource。Round 3 验收反馈已修正空评论保存/关闭语义和 Sheet chrome 过度重绘。Round 4 修正了更底层的 Sheet 生命周期偏移：空评论删除只清业务数据并驱动 `opened=false`，Svelte 组件会保留到 Framework7 `onSheetClosed` 后再释放，避免销毁 live Sheet instance 后残留 `swipeToClose` / `closeByBackdropClick` handlers。Round 5 修正 composer resource rail 偏移：动态加入的图片、文件、评论资源现在直接挂到 `messagebar-area` 的 `beforeArea`，不会再出现在发送按钮旁边。Round 6 把剩余 Chatview 临时视图收敛为 Framework7 modal 封装：composer tool sheet、message/source actions、resource/source popup toolbar chrome 不再由业务组件各自重绘。

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
- Framework7 Sheet 生命周期：source comment editor 使用 `commentEditorSheetAnchor` 保留 Sheet 到 `onSheetClosed`；comment inspector 使用 `editSheetMounted` 保留 Sheet 到 `onSheetClosed`；删除空评论不会再通过 `{#if active/open}` 直接卸载 live Sheet。
- Framework7 Sheet 官方风格：继续使用官方 `Sheet -> Toolbar -> PageContent` 直接子拓扑；移除了残留的 `--f7-sheet-border-radius` 覆盖和 toolbar inner `padding: 0` / grid 重写，让默认 Sheet radius、background、toolbar padding 由 Framework7 CSS 决定。我们只保留标题布局、图标按钮和 PageContent 内部 spacing。
- Composer 资源栏：pending image/file/comment resources 统一通过 `Messagebar` 的 `beforeArea` 进入 `.messagebar-area`，位置稳定在 draft field 上方，不再依赖 Framework7 mount-time DOM 搬运，也不会落到 send button 的 toolbar pane 旁边。
- Composer tool sheet：新增 `ComposerToolSheet` 封装，常驻挂在 `Messagebar` 子树中，让 Framework7 初始化时能把 `.messagebar-sheet` 提升到 messagebar 根节点；显示/隐藏只由 `sheetVisible` 控制。
- Contextual actions：新增 `Framework7ActionSurface`，统一 Framework7 `actions.create`、`convertToPopover`、target anchoring、close lifecycle 和非 runtime fallback；message/source 业务组件只传 action data。
- Popup chrome：resource preview 与 source popup 不再用 inline style 或自定义 background/backdrop/safe-area padding 重绘 `.popup`、navbar slot、bottom toolbar chrome；自定义样式只保留在内容和叶子 affordance。

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
- Round 4 BDD red/green：新增 retained Sheet lifecycle contract 与 official chrome stricter contract 先失败；实现 `commentEditorSheetAnchor` / `editSheetMounted` 后通过。
- `bun run --filter '@agenter/web-chat-view' test:unit -- test/comment-resource-reopen-contract.test.ts test/message-source-popup-layout.test.ts`：Round 4 复跑通过，2 files / 15 tests passed。
- `bun run --filter '@agenter/web-chat-view' typecheck`：Round 4 复跑通过，0 errors / 0 warnings。
- Round 4 live browser verification：在用户正在运行的 `bun agenter studio --dev` 上打开 `http://127.0.0.1:4173/messages/...`，进入 `127.0.0.1:4293` iframe app-view，走 `Message actions -> View source -> Comment -> Save empty`，结果 `modalIn=0`、source popup 仍可用、控制台没有 `sheet.params` / `swipeToClose` / `closeByBackdropClick` / `pageerror`。
- Round 4 live browser verification：同一 live iframe 路径走 `Message actions -> View source -> Comment -> Cancel empty`，结果 `visibleSheets=0`、`modalIn=0`、`modalOut=0`，控制台没有 `sheet.params` / `swipeToClose` / `closeByBackdropClick` / `pageerror`。
- Round 5 BDD red/green：`test/web-chat-view.test.ts -t "pending files in the shared composer"` 先失败，显示 `[part='composer-assets']` 的父级不是 `.messagebar-area`；将 `PendingAssetStrip` 移入 `beforeArea` 后通过。
- Round 5 targeted tests：`bun run --filter '@agenter/web-chat-view' test:unit -- test/web-chat-view.test.ts -t "pending files in the shared composer"` 通过，1 test passed。
- Round 5 regression tests：`bun run --filter '@agenter/web-chat-view' test:unit -- test/comment-resource-reopen-contract.test.ts test/message-source-popup-layout.test.ts` 通过，2 files / 15 tests passed。
- Round 5 typecheck：`bun run --filter '@agenter/web-chat-view' typecheck` 通过，0 errors / 0 warnings。
- Round 5 live browser verification：从 Studio `4173` 取得当前 app-view iframe URL，在 iPhone 14 viewport 直接打开 `4293` app-view，走 `Message actions -> View source -> Comment -> Save non-empty -> Close source`；结果 `shelfParentClass="messagebar-area"`、`shelfInMessagebarArea=true`、`shelfInSendPane=false`、`shelfRect.y=621`、`composerStageRect.y=666`、`sendRect.y=673`，控制台无 fatal log。截图：`review/evidence/round5-iphone14-composer-resource-rail.png`。
- Round 6 BDD/source contracts：`bun run --filter '@agenter/web-chat-view' test:unit -- test/framework7-modal-encapsulation-contract.test.ts` 通过，1 file / 3 tests passed。
- Round 6 targeted regression：`bun run --filter '@agenter/web-chat-view' test:unit -- test/framework7-modal-encapsulation-contract.test.ts test/comment-resource-reopen-contract.test.ts test/message-source-popup-layout.test.ts test/web-chat-view.test.ts -t "message actions|context menu|pending files in the shared composer|Framework7 modal|Framework7 popup|comment edit sheets|source toolbar"` 通过，4 files / 10 tests passed / 38 skipped。
- Round 6 typecheck：`bun run --filter '@agenter/web-chat-view' typecheck` 通过，0 errors / 0 warnings。
- Round 6 visual verification：隔离启动 `@agenter/web-chat-view` example harness 于 `4292/4600/4601`，重新采集 `review/evidence/round6-modal-encapsulation-after/*`；`composer-tool-sheet.png` 显示 tool sheet 已恢复为完整 messagebar sheet 区域，不再在发送按钮右侧被裁切；`message-actions.png` 为官方 iOS actions sheet；`source-popup.png` / `resource-preview.png` 保持 Framework7 popup/page/toolbar chrome。
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
- Round 4 根因偏移：Round 3 只统一了“业务 finalizer”，但没有区分“删除评论数据”和“销毁 Framework7 Sheet 组件”这两件事，导致空删除会直接让 `{#if active/open}` 卸载 live Sheet。Round 4 已把这两件事拆开。
- Round 4 DOM 偏移：真实浏览器验证发现空保存后 Framework7/Svelte 会留下一个 `display:none` 的旧 `.message-source-comment-editor-sheet` 节点，且该节点已经没有 `f7Modal/params`，当前不会再触发用户报告的 handler 报错。这个属于 Framework7 把 Sheet 节点临时搬到容器后与 Svelte 卸载边界的残留，不应在本轮为了“清零 DOM”重写生命周期。
- Round 5 根因偏移：之前把 `PendingAssetStrip` 作为 `Messagebar` children，依赖 Framework7 初始化时把 `.toolbar-inner > .messagebar-attachments` 搬进 `.messagebar-area`。但 comment resource 是后续动态插入的，父级不一定重新搬运，因此资源会留在 send button 旁边。本轮改为直接使用 `beforeArea`，不再依赖搬运副作用。
- Round 6 根因偏移：第一版封装移除了 `.messagebar-sheet` 重绘，但仍用 `{#if toolsSheetVisible}` 延迟创建 sheet；由于 composer 设置了 `resizable={false}`，Framework7 后续不会再次走 hoist 更新路径，sheet 留在 `.toolbar-inner` flex 行里并在发送按钮右侧裁切。本轮改为常驻 `ComposerToolSheet`，让官方初始化路径接管布局。
- Round 6 范围偏移：本轮没有把 example/storybook blueprint harness 里的历史 `backdrop-filter` 全部清掉；它们是蓝图/测试 harness，不是当前 Chatview app-view runtime surface。后续如要统一蓝图视觉，应单独开 change。

## 未来任务清单

- 把 remaining `env(safe-area-inset-*)` 用法整理成一个小型 visual-law audit，逐个确认是 inner-shell spacing 还是 Framework7-owned surface。
- 给 comment/source popup 增加一个 Storybook DOM contract，用真实浏览器覆盖“打开 source -> 新建 comment -> 保存 -> reopen comment preview”的全流程。
- 未来如果要给非空 comment 删除按钮，应把它作为明确 destructive icon action 加到 preview/edit controls，并在有内容时弹确认框；本轮只实现用户建议的空保存自动删除。
- 对所有 Web Chat `Sheet` 做一次官方 Framework7 chrome audit。Round 3 只修了 comment edit 相关两个 Sheet；example/review shell 里其它 Sheet 如果仍有自定义外观，需要逐个判断是产品授权还是历史残留。
- 给 source/comment edit Sheet 增加真实浏览器 interaction test，覆盖“空保存 -> Sheet 关闭 -> 再点页面无 `sheet.params` undefined console error”。
- 后续单独研究 Framework7 Svelte Sheet 的 moved-node 残留：目标是清理 `display:none` 的旧 Sheet 节点，但不能回退到直接销毁 live Sheet 的错误路径。
- 给 composer resource rail 增加 Storybook DOM contract，覆盖动态加入 comment resource 后仍在输入框上方的资源栏，而不是 send row。
- 给 composer tool sheet 增加真实 DOM/Storybook contract，覆盖“plus -> sheet 展开后 `.messagebar-sheet` 已被 Framework7 hoist 到 messagebar 根节点，而不是留在 `.toolbar-inner`”。
- 继续把 Web Chat 临时视图分成三类：Framework7-owned chrome、Web Chat-owned inner layout、leaf affordance。新增 modal 必须先选封装入口，不允许业务组件直接重绘 `.sheet-modal` / `.popup` / `.actions-modal` / `.messagebar-sheet`。
- 考虑把 actor presentation projection 从 CLI plain endpoint 进一步沉淀为长期 message-system/app-server API contract，避免未来另一个 host 重复实现目录投影。
- 如果要彻底统一头像组件，可以把 `ChatAvatar` 与 Studio/Auth profile avatar 的样式 token/尺寸契约沉淀到 shared avatar primitive。
- 等用户验收视觉效果后，再 archive `fix-web-chat-view-message-comment-polish`，不要现在直接 archive。
