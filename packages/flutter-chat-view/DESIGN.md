# flutter-chat-view design

> 本文档记录 `packages/flutter-chat-view` 的长期设计法则。它约束 Flutter-side host shell 的组件语义、视觉语气与自适应策略，不记录阶段性实现细节。

## 1. Goal

- `flutter-chat-view` 的目标不是复刻 `apple.com` 营销页，也不是把 `packages/webui` 翻译成 Flutter。
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
  - 单主舞台
  - `CupertinoTabBar` 承担 profile / conversation / details 切换
  - 不允许为了塞下三栏而压坏 transcript 可读性

- `standard 720-1099`
  - 左侧 profile rail
  - 右侧 conversation stage
  - details 下沉为下方 stacked section

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

- app-level 导航归 `CupertinoNavigationBar` / `CupertinoTabBar`。
- 页面内二级动作归 `CupertinoListTile.trailing`、navigation trailing 或 action sheet。
- 详情切换在 compact 模式必须有显式入口，不能依赖 hover 或隐性点击热区。

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
