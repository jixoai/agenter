# flutter-chat-view design

> 本文档记录 `packages/flutter-chat-view` 的长期设计法则。它约束 Flutter-side host shell 的组件语义、视觉语气与自适应策略，不记录阶段性实现细节。

## 1. Goal

- `flutter-chat-view` 的目标不是复刻 `apple.com` 营销页，也不是把 `apps/studio` 翻译成 Flutter。
- phase 1 的目标是交付一个 **Web-first、Apple idiom、Cupertino-first** 的独立房间工作台。
- 后续 iOS / Android / macOS 复用同一套 host-shell law，而不是各端重新长出一套页面语义。

## 2. Source of Truth

设计真源按优先级分三层：

### 2.1 Platform semantics first

- 组件语义、导航语义、弹层语义、safe-area 语义，优先服从 Flutter 官方 iOS / Cupertino 能力边界。
- 只要 Flutter 官方有对应 Cupertino primitive，就优先使用官方 primitive，而不是自定义壳层伪装。
- 若 Flutter 当前尚未提供稳定的 iOS 26 对应系统效果，则保守退回标准 Cupertino 语义，不伪造“像系统但其实不是系统”的假效果。

### 2.2 Apple visual language second

- [apple/DESIGN.md](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/apple/DESIGN.md) 提供视觉语气真源。
- package 只吸收其中可迁移到 app shell 的部分：
  - SF 系字体体系与紧凑排版节奏
  - 中性色主导 + 单一蓝色交互强调
  - 克制阴影、少边框、少装饰
  - 内容优先、界面退后
- package 不直接照搬其中偏营销页的结构：
  - 全屏 hero
  - 黑白交替的电影式整页段落节奏
  - 产品摄影主导的信息架构

### 2.3 Adaptive law third

- 布局法则遵守 Flutter 官方 adaptive / responsive best practices。
- 任何 viewport 变化、输入方式变化、平台变化，都先通过约束与组件替换解决，不通过硬编码设备白名单解决。

## 3. Official iOS Boundary

### 3.1 Cupertino-first shell

host shell 的主路径必须优先使用以下官方组件：

- `CupertinoApp`
- `CupertinoPageScaffold`
- `CupertinoNavigationBar`
- `CupertinoTabBar`
- `CupertinoListSection`
- `CupertinoListTile`
- `CupertinoFormSection`
- `CupertinoTextFormFieldRow`
- `CupertinoActionSheet`
- `CupertinoAlertDialog`
- `CupertinoPopupSurface`
- `CupertinoButton`
- `CupertinoScrollbar`

### 3.2 Custom UI is exception, not baseline

只允许以下区域保留必要自定义：

- transcript canvas
- chat bubble
- composer suggestion projection
- message-local affordance
- lightweight toast / feedback overlay

原因不是“追求独特”，而是 Flutter 没有官方聊天室组件。

### 3.3 Unsupported iOS 26 effects must not be faked

- 不用自定义大面积 glass card 冒充系统 liquid glass。
- 不用自造 page transition 冒充 iOS 26 zoom transition。
- 不用自绘奇异 tab bar / floating chrome 冒充新系统导航样式。
- 当 Flutter 官方 iOS 26 支持仍有缺口时，默认回退到稳定的 Cupertino 组件语义。

## 4. Host Shell Structure

### 4.1 Shell layering

host shell 固定分四层：

1. App chrome
- app title
- app-level navigation
- global create / import affordance

2. Workspace chrome
- profile directory
- active room context
- detail navigation

3. Conversation stage
- transcript
- composer
- room-local error / loading / retry

4. Detail surfaces
- room facts
- participants
- selected message facts

### 4.2 Responsibility split

- `ProfileRail` 负责 profile discovery / activation / edit entry。
- `ChatStagePanel` 负责当前房间主舞台。
- `DetailRail` 负责 room-local facts，不复制主舞台控制权。
- 配置表单、删除确认、操作菜单统一走系统语义弹层，不长出自定义 modal shell。

### 4.3 One primary action per surface

- 每个 surface 只允许一个 primary action。
- 次级动作进入 list trailing、sheet action 或 navigation trailing。
- 不允许一个区块同时堆多个视觉同等级按钮争夺主导权。

## 5. Visual Law

### 5.1 Color law

- 以系统中性色与 Apple 风格中性色为主：
  - light canvas: 接近 `#f5f5f7`
  - text: 接近 `#1d1d1f`
  - accent: Apple blue / Cupertino primary blue
- 蓝色只用于交互元素、焦点与可操作 affordance。
- 禁止把蓝色扩散到被动背景、大片装饰或状态板块。
- 错误、警告、成功状态使用系统语义色，不自造品牌状态色板。

### 5.2 Surface law

- 主阅读面优先使用 `systemGroupedBackground` / `secondarySystemGroupedBackground` 体系。
- 大多数面不需要阴影；层级主要通过 grouped background、inset、section header 与 safe spacing 表达。
- 边框只在 Flutter / Cupertino 默认语义需要时出现；不要为了“像卡片”额外描边。
- glass / blur 只允许出现在：
  - `CupertinoNavigationBar`
  - `CupertinoPopupSurface`
  - 系统式 transient overlay
- transcript 不是 glass surface，不应影响可读性。

### 5.3 Typography law

- 优先继承 `CupertinoTextTheme`，不要在业务层手搓多套字体系统。
- 字体语气对齐 Apple：
  - headline 紧凑
  - body 节制
  - caption 清晰但不喧宾夺主
- 标题可居中，正文默认左对齐。
- 不使用夸张字重梯度；常用权重维持在 400 / 600 / 700。
- 不通过过大字号制造层级，优先靠节奏、留白、位置与组件语义建立层级。

### 5.4 Ornament law

- 禁止 gradient 背景、纹理背景、发光球、营销式光晕。
- 禁止多层重阴影。
- 禁止大面积自定义圆角玻璃卡片作为页面骨架。
- 禁止把视觉 novelty 放在聊天主通路之前。

## 6. Adaptive and Responsive Law

### 6.1 Constraint-first, not device-first

- 先看可用宽度与输入环境，再决定布局。
- 禁止依据“iPhone / iPad / desktop”硬编码 UI 结构。
- 禁止把 orientation 当成主判断条件；宽度与可用空间比 orientation 更重要。

### 6.2 Current layout contract

- `compact < 720`
  - conversation-first 单主舞台
  - active chat 底部只归 transcript / composer / safe-area，不再出现持久 bottom nav
  - profile directory 通过 leading navigation action、pushed page 或 Cupertino sheet 进入
  - room facts、participants、selected message facts 通过 inspector route / sheet 进入
  - 不允许为了塞下三栏或三 tab 而压坏 transcript 可读性

- `standard 720-1099`
  - 左侧 profile rail
  - 右侧 conversation stage
  - details 通过 transient inspector surface 进入，不能抢占 conversation measure

- `expanded >= 1100`
  - profile / conversation / details 三栏并置
  - 聊天主舞台保持主视觉中心

### 6.3 Responsive best practices

- break down widgets:
  - 大布局拆成可独立替换的 shell atoms，而不是在一个 build 里堆满条件分支
- support all input modes:
  - 触摸、键盘、鼠标、滚轮都必须可用
- preserve state across resize:
  - viewport 变化时，active profile、selected message、draft、scroll position 不应被无故清空
- avoid wasted width:
  - 宽屏下不给正文无限横向拉伸
  - 可读内容应保持合理 measure
- design to the strengths of each form factor:
  - mobile 用分段和 tab 切换
  - desktop / tablet 才展开并行多栏
- keep conversation measure bounded:
  - expanded 模式下，聊天主舞台的有效阅读宽度必须被显式约束
  - 不允许让 stage summary、error banner、empty state 在超宽列里无限摊平

### 6.4 Scroll ownership

- 每个 major panel 只允许一个主滚动区。
- rail、stage、detail 各自拥有自己的滚动所有权，不嵌套多层抢滚动。
- surface 收缩时优先保住滚动能力，再谈视觉裁剪。

### 6.5 Header density

- stage summary 在 compact 模式最多保留两行主要 tile：
  - 房间身份
  - 连接状态 / 详情入口
- profile actions 进入当前 tile 的 trailing action，不单独再占一整行。
- error notice 需要显眼，但不能把聊天主舞台首屏挤成只剩 banner 和 composer。

### 6.6 Composer adaptation

- 只要当前宽度仍能同时容纳 `44x44` 级别的 leading action、send action 与可读输入框，composer 就保持单行布局。
- 只有在真实窄约束下才允许 send action 下沉为 stacked 布局。
- compact 不是纵向堆叠的许可；约束不足才是。

## 7. Interaction Law

### 7.1 Navigation

- app-level 导航优先归 `CupertinoNavigationBar`；`CupertinoTabBar` 只允许用于真正同级的顶层 app areas。
- active compact conversation 不允许出现持久 bottom nav；底部必须保留给 composer。
- 页面内二级动作归 `CupertinoListTile.trailing`、navigation trailing、inspector sheet、popover/menu 或 action sheet。
- profile directory、room details、selected-message facts 在 compact 模式必须有显式入口，不能依赖 hover 或隐性点击热区。
- compact route sheet 必须选择语义 detent，而不是传 raw height：profile directory 是 `page` detent，room inspector 与 selected-message inspector 是 `inspector` detent。
- route sheet primitive 负责 viewport width、bottom alignment、navigation title/close、safe-area padding；`ProfileRail` / `DetailRail` 只负责内容与滚动，不接管 sheet 约束。

### 7.2 Forms and dialogs

- profile create / edit 使用 `CupertinoFormSection` + `CupertinoTextFormFieldRow`。
- destructive confirm 使用 `CupertinoAlertDialog`。
- action overflow 使用 `CupertinoActionSheet`。
- 禁止发明自定义 dialog chrome 去模拟 iOS。

### 7.3 Feedback and errors

- loading 使用简洁 `CupertinoActivityIndicator`。
- transport error 需要在主舞台可见，不藏进次级面板。
- success feedback 用轻量 toast / inline confirmation，不用营销式 banner。

### 7.4 Keyboard and focus

- Web-first 阶段仍必须保留键盘捷径和可见 focus 语义。
- 焦点态优先沿用 Cupertino / 系统蓝色，不自造高饱和 focus 样式。
- 弹层打开后必须有明确的焦点收敛与关闭路径。

### 7.5 Accessibility and density

- icon-only action 必须保留至少 `44x44` 的命中区域，并提供明确语义标签。
- icon-only action 在 Web 语义树里只能暴露一个带本地化 label 的 button；primitive 必须排除内部 icon/按钮导致的 unlabeled duplicate semantics。
- icon-only action 必须复用同一份本地化 label 提供 tooltip / long-press help；tooltip 只负责可见帮助，不得生成第二个语义 button。
- compact 模式优先折叠次级动作和长原始值；不要把 room title、overflow action、share URL 挤在同一个首屏 surface。
- 长 URL、token、share link 默认不直接占据主信息位；优先提供 copy action，让原始值退到次级细节。

## 8. Web-first but Portable

- phase 1 虽然只交付 Web，但 shell 结构必须对 iOS / Android / macOS 可移植。
- 因此：
  - 不依赖 Web 专属视觉 hack
  - 不把 URL import 流程写死为浏览器独有页面逻辑
  - 不把 hover-only affordance 作为主路径
- Web 阶段的特殊需求，只能作为 host capability 插槽存在，不能污染 shell law。

## 9. Do / Don't

### Do

- 优先用官方 Cupertino 组件组成 shell
- 保持中性色主导与单一蓝色交互强调
- 让聊天内容成为主舞台，配置与详情成为辅助层
- 依据宽度和约束切换布局
- 在 compact 模式先折叠 chrome，再牺牲非关键信息
- 保持 keyboard / pointer / touch 三种输入可达

### Don't

- 不要用自定义 glass card 当作默认页面骨架
- 不要把 Apple 官网营销页节奏原样搬进聊天应用
- 不要用 gradient、辉光、重阴影营造“高级感”
- 不要用硬编码设备类型决定布局
- 不要在多个面板重复同一状态和动作
- 不要为了“像 iOS26”去伪造 Flutter 当前没有的系统效果

## 10. References

- Apple-inspired visual language:
  - [apple/DESIGN.md](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/apple/DESIGN.md)
- Flutter official iOS entry:
  - https://docs.flutter.dev/platform-integration/ios/ios-latest
- Flutter adaptive / responsive best practices:
  - https://docs.flutter.cn/ui/adaptive-responsive/best-practices/

## 11. Apple Platform Law

- The Flutter app shell follows Apple platform semantics, not a generic web-card aesthetic. Use Cupertino navigation, tab, list, sheet, and dynamic color primitives before custom layout.
- `AppleMaterialSurface` is the only app-shell primitive that may combine background, border, blur, radius, and clipping for app-level sidebar/content/inspector/bar surfaces.
- Apple spacing is a rhythm law, not an individual style. Shell margins, column gaps, surface radii, and compact edge-to-edge behavior must come from `ApplePlatformTokens` / `appleShellMargins`, not feature-local `EdgeInsets` guesses.
- Compact iPhone layouts are edge-to-edge under Cupertino navigation and tab bars. Do not wrap the active route in a large rounded card; use grouped backgrounds inside content only when the content semantics require grouping.
- Regular and expanded layouts default to iPad-style split view: app-level sidebar/content/inspector surfaces are edge-to-edge and separated by thin system dividers. Rounded corners belong to contained semantic groups, sheets, notices, and controls—not to every major route panel.
- Business widgets must not hand-roll `background + radius + border/shadow` for app-level chrome; add or extend an Apple primitive instead.
- `AppleContentUnavailable` is the default empty-state primitive for profile, room, and conversation absence. Empty states must be quiet, short, and task-oriented rather than marketing hero sections.
- Top navigation and bottom tab surfaces own their safe-area and separator behavior. Content panels must not add extra bottom padding to simulate tab spacing.
- All icon-only controls must use `AppleIconButton` or an equivalent primitive with at least a 44pt hit target and a semantics label.
- `AppleIconButton` owns icon-only semantics: one localized button label, no unlabeled duplicate button node, and child icon semantics excluded.
- `AppleIconButton` owns icon-only discoverability: tooltip / long-press help derives from the same localized label and is excluded from semantics.
- `CompactRouteSheet` owns compact secondary/tertiary route detents. Feature code selects semantic detents (`page`, `inspector`) and must not pass ad-hoc popup heights.
- App-shell colors must resolve through `CupertinoDynamicColor` or Apple platform tokens. Fixed raw colors are allowed only inside token definitions.
- Liquid Glass is modeled as a progressive material primitive on Web: blur/alpha when available, dynamic solid fallback when unavailable. Do not name feature code after unreproducible private system effects.
- Version-branded visual shims such as `ios26_*` are not allowed in the example shell. If a visual rule is durable, name it by semantic role (`Apple*`, stage, section, transcript) rather than by a speculative OS version.

## 12. AI Prompt: Native Apple Review Loop

Use this prompt when an AI agent reviews or changes Flutter Chat View UI. The goal is to force first-principles Apple platform reasoning instead of local style tweaking.

```text
You are reviewing `packages/flutter-chat-view` as an Apple platform interface designer and Flutter architect.

Do not start by changing colors, border radius, or padding. First identify the semantic layer:
1. App shell: navigation bars, tab bars, dual-pane columns, safe areas.
2. Route surface: conversation stage, profile rail, detail rail.
3. Section rhythm: grouped list sections, section labels, body padding, control gaps.
4. Content atoms: message rows, composer, attachments, metadata, buttons.

Apply these laws:
- iPhone compact layouts are edge-to-edge under `CupertinoNavigationBar`; active conversation owns the bottom edge with transcript/composer, not a persistent bottom nav.
- iPad/desktop layouts read as split view: app-level panels are separated by thin system dividers, not floating dashboard cards.
- Major app-level backgrounds/radius/borders go through `AppleMaterialSurface`; feature code must not hand-roll `background + radius + border`.
- Section spacing goes through `AppleSection`, `AppleSectionBody`, `AppleSectionLabel`, `ApplePanelGap`, `AppleActionGroup`, and `ApplePlatformTokens`; feature code must not invent one-off `EdgeInsets.fromLTRB(...)` values for section rhythm.
- Compact profile/details/message surfaces go through `CompactRouteSheet` with semantic detents. Do not use one-off modal heights or content-driven popup sizing for route surfaces.
- Icon-only actions go through `AppleIconButton`; verify browser snapshots do not show unlabeled duplicate buttons.
- Rounded corners belong to contained semantic groups, sheets, notices, controls, and message bubbles—not to every route panel.
- Empty states should be quiet, centered, task-oriented, and short; do not use marketing hero layouts inside a utility chat app.
- One region owns each fact and each action. Do not repeat connection status, share actions, or profile actions across adjacent surfaces unless compact navigation makes it necessary.
- Validate desktop and iPhone 14. Desktop must not look like web dashboard cards; mobile must not show a floating card around the route.

Review checklist before reporting done:
- Are shell margins, column gaps, section gaps, body padding, and radii read from `ApplePlatformTokens` or Apple primitives?
- Are all app-level surfaces expressed with `AppleMaterialSurface` or native Cupertino bars/tabs?
- Are section groups expressed with `AppleSection*` primitives?
- Did widget tests lock compact edge-to-edge and desktop dual-pane rhythm?
- Did wasm web evidence include both `main.dart.wasm` and `skwasm.wasm`?
```

## 13. AI Prompt: Implementation Guardrails

```text
When implementing Flutter Chat View UI changes:
- Treat visual rhythm as platform law, not local style. Add a primitive/token if a new spacing pattern is needed.
- Do not introduce `if (isIOSLikeSpecialCase)` style branches. Use layout size classes and semantic surface roles.
- Prefer Cupertino widgets before custom Flutter containers.
- Keep transport, upload, controller, rendering, and shell visual primitives orthogonal.
- Add or update BDD-style widget tests for any new durable visual law.
- Run `flutter analyze`, package `flutter test`, example `flutter test`, then wasm browser walkthrough.
```

## 14. Chat Content Rhythm Law

- Chat content has its own rhythm law separate from app-shell chrome. `ChatSurfaceTokens` is the single source for message max width, bubble radius, message padding, block gap, block padding, composer padding, action hit size, inline gaps, pill padding, transcript padding, notice rhythm, empty-state rhythm, and return-to-latest motion thresholds.
- `FlutterChatView`, `ChatMessageTile`, `ChatComposer*`, `ChatMarkdownView`, attachments, and interactive/error/reply blocks must read rhythm from `chatTokens(context)` or helpers such as `chatComposerOuterPadding`.
- Feature code must not introduce one-off `EdgeInsets.fromLTRB(...)`, bubble radii, pill padding, or composer action sizes. If a new content pattern needs spacing, extend `ChatSurfaceTokens` first.
- Message bubbles remain contained content atoms. They can be rounded, but their radius must be quieter than app-level cards and consistent across text, replies, errors, attachments, and interactive forms.
- Composer is a control surface: it owns its action hit targets and field padding, while the parent stage owns only outer placement.
- Markdown/code/blockquote spacing is a projection of message rhythm. Renderer logic must not invent separate visual spacing unrelated to `ChatSurfaceTokens`.

## 15. Transcript Motion & Stage Notice Law

- Transcript scroll is a lifecycle-sensitive platform law. Feature widgets must not call `ScrollController.animateTo` directly from transient gestures unless the call is guarded by `hasClients`, `hasContentDimensions`, `mounted`, and post-frame timing where needed.
- Return-to-latest is a persistent stage affordance, not a conditional subtree. Keep the control mounted and toggle `Opacity`, `IgnorePointer`, and semantics exposure instead of removing it during the same gesture that starts scroll motion.
- Stage notices, time dividers, loading affordances, empty transcript copy, and return-to-latest controls are transcript chrome. Their padding, radius, gaps, icon sizes, and thresholds must come from `ChatSurfaceTokens`.
- Visibility telemetry is not allowed to create rebuild storms. If a scroll or visibility primitive emits high-frequency facts, it must be throttled, coalesced, or kept out of app-shell rebuild paths unless a durable user-visible fact changed.
- Scroll commands must be idempotent. Repeated taps, controller updates, viewport changes, or disposal during animation must converge without render assertions or unhandled futures.
- Virtualized transcript rows must not let `GestureDetector` own semantics while rows are being created and disposed during scroll. Put explicit `Semantics(onTap: ...)` on the stable row atom and set gesture recognizers to exclude their generated semantics.
- Transcript and Web demo shell surfaces must not mount `SelectableRegion`, `HtmlElementView`, or any other Flutter Web platform view. On Web these create `_PlatformViewPlaceholderBox` post-frame layout callbacks that can outlive disposed rows during scroll animations. Message copying must be provided by stable message actions instead.

### AI Prompt Addendum: Chat Content Review

```text
When reviewing chat content UI, inspect these before changing pixels:
1. Is this app shell, section rhythm, or chat content rhythm?
2. If it is chat content, does the value come from `ChatSurfaceTokens`?
3. Are message bubbles, markdown blocks, reply previews, attachments, read receipts, and composer controls using the same block gap/inline gap/padding vocabulary?
4. Did tests cover the durable token contract instead of private implementation details?

Do not patch individual `Padding`, `BorderRadius`, or `SizedBox` values inside chat widgets. Promote durable values to `ChatSurfaceTokens`, then consume them from every related atom.
```

### AI Prompt Addendum: Transcript Motion Review

```text
When reviewing transcript scrolling or "latest" behavior:
1. Identify whether the change affects transcript content, stage chrome, or shell chrome.
2. Do not remove a pressed overlay control in the same frame that its gesture starts an animation; keep the affordance mounted and hide it semantically.
3. Guard every scroll command with mounted/client/content-dimension checks and tolerate disposal during animation.
4. Route padding, icon gap, bottom inset, visibility thresholds, and animation duration through `ChatSurfaceTokens`.
5. For selectable transcript rows, keep semantics explicit and disable generated gesture semantics in virtualized row gesture recognizers.
6. Do not place `SelectableRegion` inside message rows, detail rails, or Web shell surfaces; if text copy is required, expose it through a stable message action.
7. Add a BDD widget test with semantics enabled that taps return-to-latest after the transcript is scrolled away from the bottom and asserts no Flutter exception is reported.
```
