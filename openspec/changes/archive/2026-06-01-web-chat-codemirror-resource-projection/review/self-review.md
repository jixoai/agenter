# Self Review: Web Chat CodeMirror Resource Projection

## 结论

本轮实现与 `plans/plan.md` 的 Round 13 safe-padding container 法则对齐，可以进入用户走查。数据库与发送边界没有重新引入 `webChatCommentResources` 或其它 WebChat 结构化资源 sidecar；本轮只升级前端投影层。composer 现在仍是 writable CodeMirror，能够把 `[^Comment 1]` 这类 Markdown footnote token 投影成 icon-with-number 资源节点；message bubble 仍是 readonly CodeMirror，继续隐藏 footnote definition，并从同一资源引用解析入口渲染 inline token 与 in-bubble resource bar。共享图标原子现在支持不同 ink/surface/border/badge 变量，image 图标和数字同色，file 图标保持 No 居中并把文件后缀放到右下角标。可见图标内部已统一为两层 SVG：底层 base icon layer，上层 info layer。Round 5 已把 base glyph 改为官方 lucide `MessageSquareDot` / `Image` / `File` 组件，image No 与圆标中心坐标一致，comment No 从上一版缩小，file info layer 采用用户给出的 scale/offset/badge 坐标并保留 `1rem + scale` 文本法则。Round 6 已把两层 SVG 从 `position:absolute` / `inset:0` 缝合改为同一个 `inline-grid` 网格单元内重叠，并把 comment/image/file base glyph 透明度统一到 `--resource-icon-base-opacity`。Round 7 已把匿名 `grid-area: 1 / 1` 改成 `grid-template-areas: "resource-icon-layer"` 与 `grid-area: resource-icon-layer`。Round 8 修正了 Svelte scoped CSS 没覆盖 lucide 组件内部 SVG 的问题：layer 布局规则现在通过组件根下的 `:global(.resource-icon-layer)` 作用到 lucide base SVG 和本地 info SVG，并用 Storybook DOM 断言两个真实 SVG 的 computed `grid-area` 都包含 `resource-icon-layer`。Round 9 已显式声明 base layer z-index 为 `0`、info layer z-index 为 `1`，并用 Storybook DOM 断言 info 层高于 base 层。Round 10 已写入用户手动微调的 comment/file info SVG 坐标和 file extension badge stroke。Round 11 已写入用户手动微调的 image badge 坐标/stroke，并移除 inline-only file extension badge translate，避免 mini file badge 被额外推到 icon 外。Round 12 已移除整个 file info SVG 的 transform，把原来的 `translateY(2px) scale(0.8)` 折算进内部 file number/badge/extension 坐标和文本 scale，确保 base SVG 与 info SVG 默认同尺寸叠放。Round 13 已在容器上加入 `padding = min(border-radius, width, height) / 4` 的安全内边距，防止圆角裁剪内部 SVG。

## 法则变动

- 新增共享 CodeMirror 资源 token 投影原子：`message-markdown-resource-token-projection.ts`。
- 新增共享资源视觉原子：`resource-icon-with-number.svelte` + `resource-icon-number.ts`，统一 comment/file/image 的编号显示；编号只保留 `1..9`，超出显示 `*`。
- `resource-icon-with-number.svelte` 升级为 CSS-variable-driven 视觉原子，支持 `--resource-icon-ink`、`--resource-icon-surface`、`--resource-icon-border`、`--resource-icon-badge-surface`、`--resource-icon-badge-border`。
- 图标内小文本统一使用 `font-size: 1rem` 加 transform scale，避免依赖浏览器可能钳制的小字号。
- `resource-icon-with-number.svelte` 的可见内部绘制从 lucide SVG + HTML span overlay 改为两张叠加 SVG：`data-resource-icon-layer="base"` 绘制资源 glyph，`data-resource-icon-layer="info"` 绘制编号、badge、extension。
- `resource-icon-with-number.svelte` 的 base icon layer 进一步收口到官方 lucide `MessageSquareDot` / `Image` / `File` 组件，不再维护手写 lookalike path。
- image badge 的圆心和数字坐标保持一致；comment 数字缩小；file info layer 使用用户给出的 `scale(0.8)`、下移和右下角 badge 坐标。
- `resource-icon-with-number.svelte` 的图层重叠由 `display: inline-grid` / `grid-area: 1 / 1` 承担，删除 `.resource-icon-layer` 上的 `position:absolute` 与 `inset:0`。
- comment/image/file base glyph opacity 统一为 `--resource-icon-base-opacity`，避免 comment 单独拥有不可解释的透明度。
- `resource-icon-with-number.svelte` 的图层重叠进一步从匿名网格线改为 named area：外层声明 `grid-template-areas: "resource-icon-layer"`，base/info SVG 都声明 `grid-area: resource-icon-layer`。
- `resource-icon-with-number.svelte` 的 layer 布局选择器改为 `.resource-icon-with-number :global(.resource-icon-layer)`，确保 lucide 组件生成的 base SVG 和本地 info SVG 都由同一个 named area 控制。
- `CodeMirrorResourceProjection` Storybook DOM 断言现在读取 base/info 两个真实 SVG 的 computed `grid-area`，防止 scoped CSS 只命中其中一层。
- `resource-icon-with-number.svelte` 新增 `--resource-icon-base-layer-z-index: 0` 与 `--resource-icon-info-layer-z-index: 1`，并把 z-index 应用到真实 base/info SVG layer。
- `CodeMirrorResourceProjection` Storybook DOM 断言现在读取 base/info 两个真实 SVG 的 computed `z-index`，确保 info 层高于 icon 层。
- `resource-icon-with-number.svelte` 写入用户微调坐标：comment number `x=10.2 y=11`；file number `y=11.8`；file badge rect `y=19`；file extension text `y=21.2`。
- file extension badge stroke 改为 `currentColor`，`stroke-width` 改为 `0.5`。
- `resource-icon-with-number.svelte` 写入用户微调 image 坐标：image badge circle `cx=18 cy=6 r=4.2`；image number `x=18 y=5.8`。
- image number badge stroke 改为 `currentColor`，`stroke-width` 改为 `0.5`。
- 删除 inline-only `.resource-icon-file-extension-badge` translate，使 mini 和 standard file badge 使用同一套 SVG 坐标，只保留字号 scale 的 size 差异。
- 删除 `.resource-icon-file-info-layer` 的 whole-SVG transform；file internal 坐标折算为 number `y=13.84`、badge rect `x=12 y=19.6 width=8.8 height=3.84 rx=0.84`、extension text `x=16.4 y=21.36`。
- file 文本 scale 折算为 number `0.656`、extension `0.24`，inline extension scale 为 `0.152`，不再通过整层 SVG scale 实现。
- `resource-icon-with-number.svelte` 增加 `--resource-icon-width`、`--resource-icon-height`、`--resource-icon-border-radius`、`--resource-icon-effective-radius`、`--resource-icon-safe-padding`，并把 container padding 设为 `calc(min(radius,width,height) / 4)`。
- tile 默认 radius 为 `11px`；inline radius 为 `0.33em`；Storybook DOM 会分别读取 tile/inline computed padding 并按 `min(border-radius,width,height)/4` 校验。
- readonly bubble 的 token 解析从 bubble-only preview 实现迁移到共享原子；bubble 自己仍只负责 readonly mode policy：隐藏 definition、结构化 Markdown preview、resource bar。
- writable composer 只启用 inline token decoration，不隐藏 footnote definition/source block，避免把编辑器变成预览器。
- composer token activation 走 `WebChatResourceReference`，并接入 composer 侧 `ResourcePreviewLayer`；pending comment 仍保留空内容删除与保存语义。
- `message-markdown-resource-bar` 改为固定 tile 尺寸、可换行、无默认滚动条的 icon strip；本轮定位并修复了 `ResourceCard` 内 sr-only 文案导致 bar 垂直 scrollHeight 被撑大的问题。

## 原子产出

- `ChatDraftEditor`：接入 `markdownResourceTokenProjection(...)`，通过 refresh effect 响应资源引用变化，保留 typing、cursor、Enter submit、completion。
- `MessageMarkdownContent` / `messageMarkdownPreview`：继续 readonly，复用共享 token 解析。
- `MessageMarkdownResourceToken`：不再把 `[^Comment 1]` 作为可见 bracket 文本，改为同一 icon-with-number atom，并保留 aria-label/title；其 visible marks 不再由 token surface 自己叠 HTML。
- `ResourceCard` / `ResourcePreviewLayer`：移除重复手写 icon overlay，复用同一个 icon-with-number atom。
- `CodeMirrorResourceProjection` Storybook story：真实挂载 `ChatDraftEditor` + `MessageMarkdownContent`，在 Chromium 中断言 writable/readonly facets、token 数量、definition 隐藏、resource bar、token open、编辑和 Enter submit。
- `resource-projection` example route：用于最终人工走查与截图，不依赖不稳定的 Storybook dev iframe；现在同时展示 image/comment/file 三种图标变体和 4 组不同 ink/surface 背景矩阵。

## 证据

- OpenSpec apply commit-check：通过，latest spec commit `793f6efa docs(spec): refine web chat resource icon projection`。
- Before screenshots：
  - `.screenshot/before/web-chat-example-desktop-before.png`
  - `.screenshot/before/web-chat-example-iphone14-before.png`
- After screenshots：
  - `.screenshot/after/web-chat-resource-projection-desktop-after.png`
  - `.screenshot/after/web-chat-resource-projection-iphone14-after.png`
- Latest route screenshots recaptured after the layered-SVG refactor at `2026-06-01 13:04` local time.
- Screenshot DOM facts：desktop/mobile 均为 `tokenCount=4`、`iconCount=19`、`baseLayerCount=19`、`infoLayerCount=19`、`everyIconHasTwoSvgLayers=true`、`paletteIconCount=12`、`hasRawDefinition=false`，resource bar 为 `scrollWidth=clientWidth=118`、`scrollHeight=clientHeight=36`。
- Round 4 visual facts：image icon glyph and image number both compute to `rgb(51, 65, 85)`；file No center delta is `x=0` / `y=-0.58px`；file extension badge remains bottom-right；file No and extension computed font-size are both `16px` with transform scale matrices.
- `bun run typecheck` in `packages/web-chat-view`：0 errors / 0 warnings。
- `bun run typecheck` in `packages/web-chat-view/example`：0 errors / 0 warnings。
- `bun run test:unit -- test/resource-icon-number.test.ts test/message-markdown-resource-token-projection.test.ts test/message-markdown-content.test.ts test/comment-resource-reopen-contract.test.ts`：4 files / 22 tests passed。
- `bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts`：2 files / 3 tests passed。
- `bun run openspec:vision -- validate web-chat-codemirror-resource-projection`：valid。
- `bun run openspec:vision -- check web-chat-codemirror-resource-projection`：ok。
- `git diff --check`：通过。
- Round 5 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/resource-icon-number.test.ts test/message-markdown-resource-token-projection.test.ts test/message-markdown-content.test.ts test/comment-resource-reopen-contract.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过；`bun run openspec:vision -- validate web-chat-codemirror-resource-projection` valid；`bun run openspec:vision -- check web-chat-codemirror-resource-projection` ok；`git diff --check` 通过。
- Round 6 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 7 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 8 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 9 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 10 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 11 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 12 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。
- Round 13 targeted verification：`bun run typecheck` in `packages/web-chat-view` 通过；`bun run typecheck` in `packages/web-chat-view/example` 通过；`bun run test:unit -- test/comment-resource-reopen-contract.test.ts test/resource-icon-number.test.ts` 通过；`bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts test/storybook/resource-square-tile-blueprint.stories.test.ts` 通过。

## 偏移清单

- Browser 插件路径：已按 Browser skill 尝试连接 in-app browser，但当前 `agent.browsers.list()` 为空，无法使用 Browser backend；截图走查改用 Playwright，并在证据中记录。
- Svelte MCP：`list_sections` 与 `svelte_autofixer` 均返回 `Transport closed`，无法作为验证入口；本轮用 `svelte-check`、unit、Storybook DOM 和真实 route screenshots 兜底。
- Round 5 截图：用户明确要求“你不用看截图，直接按我说的微调好，我来看”，所以本轮没有重新截图；保留同一个 dev server walkthrough route 给用户直接验收。
- Storybook dev iframe：`test:dom` 的 Storybook browser path 通过；但直接打开 Storybook dev iframe 在 Bun workspace 下会被 Storybook 自身 runtime `.svelte` 文件处理卡住。本轮不扩大 Vite FS 权限，不把这个非目标问题混入实现；人工走查 URL 使用 example route。
- 截图入口：before 是现有 example root，after 是专门的 `/resource-projection` route。它们不是同一路由逐像素对比，证据用途是展示“实现前 app baseline”和“实现后目标能力可视化”。
- 视觉范围：after harness 是验证/走查 surface，不是最终产品页面；它只展示 composer writable 与 bubble readonly 的资源投影，不代表 Chat 主界面整体视觉定稿。

## 用户走查入口

- 当前 dev server：`http://127.0.0.1:6120/resource-projection`
- Storybook DOM 行为测试入口：`packages/web-chat-view/test/storybook/chat-composer-stage.stories.test.ts`

## 后续预警

- 如果未来要让 composer 内 token 与 pending resource rail 共用同一个 preview owner，应把 composer/rail 的 preview 状态提升成明确 composer-level preview law；本轮保持最小正交实现，没有重写 pending strip。
- 若后续继续依赖 Storybook dev iframe 做截图，需要单独开 change 处理 Bun workspace + Storybook Svelte runtime 的 dev-server 兼容问题。

## Round 17 复盘

### 法则变动

- Composer resource pool 从“host + transcript + live + draft comments”的混合池收口为“host composer-scoped + live current composer + draft comments”。Sent transcript resources 只留在 message row / room resource 面板等 readonly projection 路径，不再进入 composer completion。
- Review example 不再把 `shellState.resourceReferences` 传给 `composerCapabilities.resourceReferences`；room resources 仍保留在资源面板里展示，但不再污染 `@` / `^` 输入。
- Draft comment 编号只按当前 composer draft 里的 comment resources 递增，不再参考全局/历史 resource list。
- Pending image/file 被接受后立即把对应 pending resource id 设为 preview target，等价于自动点击资源栏图标。
- Resource preview header eyebrow 使用引用名（如 `Image 1` / `File 1`）并取消 uppercase 变形；completion row detail 优先显示 file name。

### 原子产出

- `WebChatViewRoot`：移除 transcript-derived composer resource merge，复用 `commentResourceToReference` 构造 draft comment reference。
- `DefaultComposer`：上传成功后自动打开新 pending asset preview；删除当前 preview asset 时同步关闭 preview。
- `ResourcePreviewLayer` / `ResourcePreviewShell`：preview header 使用 reference label 原样显示。
- `composer-contract`：resource completion detail 从 `detailText ?? fileName` 改为 `fileName ?? detailText`。
- `review-shell-client`：host example 不再把 room resource references 当 composer resource references 传入。
- `composer-resource-scope-contract.test.ts`：新增 source-level contract，锁住 composer scoping、upload auto-preview、preview header copy 和 example host 边界。

### 证据

- `bun run typecheck` in `packages/web-chat-view`：0 errors / 0 warnings。
- `bun run typecheck` in `packages/web-chat-view/example`：0 errors / 0 warnings。
- `bun run test:unit -- test/composer-live-resource-completion-contract.test.ts test/composer-resource-scope-contract.test.ts test/comment-resource-reopen-contract.test.ts`：3 files / 14 tests passed。
- `bun run test:dom -- test/storybook/chat-composer-stage.stories.test.ts`：1 file / 2 tests passed。
- `bun run openspec:vision -- validate web-chat-codemirror-resource-projection`：valid。
- `bun run openspec:vision -- check web-chat-codemirror-resource-projection`：ok。
- `git diff --check`：通过。
- Desktop Playwright walkthrough：
  - Blank `@` completion no longer contains historical `ios26-thread.png` or `Keep the pendant row` transcript resources.
  - Image upload auto-open header: `Image 1 | round17-sample.png | IMAGE · 70 B · image/png`。
  - File upload auto-open header: `File 1 | round17-spec.pdf | FILE · 18 B · application/pdf`。
  - After image upload, `@` completion shows `@Image 1 | round17-sample.png`。
  - After file upload, `@` completion shows `@File 1 | round17-spec.pdf`。
- iPhone 14 Playwright walkthrough：
  - Mobile `@` completion no longer contains historical image/comment transcript resources.
  - Mobile image upload auto-open header: `Image 1 | mobile-round17.png | IMAGE · 70 B · image/png`。
- Screenshots:
  - `.screenshot/after/web-chat-round17-upload-preview.png`
  - `.screenshot/after/web-chat-round17-file-preview.png`
  - `.screenshot/after/web-chat-round17-upload-preview-iphone14.png`

### 用户走查入口

- 当前 example：`http://127.0.0.1:6120/`
