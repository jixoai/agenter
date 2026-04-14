# Design Best Practices

本文件沉淀仓库级的 WebUI 设计法则，作为 `AGENTS.md` 之外的视觉与信息架构真源。

目标：

- 让新页面长在现有应用壳层里，而不是长成另一套产品。
- 让布局、导航、工具栏、内容区的职责稳定，不靠临时视觉补丁兜底。
- 让后续页面在同一套页面物理法则下演进。

## 0) 文档边界

- `DESIGN.md` 只记录 **原则性的、可复用的、durable 的设计规则**。
- `DESIGN.md` 默认不记录具体业务页面的字段、实体、阶段性 IA、临时结论或重构过程。
- 业务内容只在两种情况下进入本文件：
  - 作为说明原则的简短例子
  - 该业务约束已经稳定到足以成为长期设计法则
- 具体业务页面、系统重构阶段结论、一次性页面编排，优先进入 `openspec/changes/*`、相关 `spec.md`、实现文档或设计稿。

## 1) 总体设计原则

- **先继承已有应用，再讨论新页面**：新页面必须首先尊重当前真实应用的布局语言、密度和导航结构。
- **先结构，后样式**：先确定页面壳层、信息层次、滚动所有权，再微调圆角、边框、背景和字重。
- **页面必须像应用的一部分**：禁止把 page-content 设计成独立落地页、大卡片集合或另一套 workbench。
- **固定 chrome，弹性内容**：应用壳层的稳定感优先于单页视觉炫技。

## 2) 三层布局法则

这是当前 WebUI 的强约束，后续设计不得偏离：

1. 整体应用：
   - `left-sidebar + chrome-window`
2. `chrome-window` 内部：
   - `tabs + page-toolbar + page-content`
3. `page-content` 内部：
   - `main-area + bottom-area + right-drawer`

约束：

- `left-sidebar` 是全局导航，不属于 page-content。
- `chrome-window` 是一个完整的应用窗口，而不是普通内容容器。
- `page-toolbar` 固定高度，承担页面级身份、局部动作与响应式编排基础。
- `page-content` 是真正的工作区，负责承载内容、滚动与细节面板。

## 3) Left Sidebar 契约

- 左侧导航采用 **一级导航 + 二级导航** 模式。
- 所有一级导航都允许挂载二级导航。
- `pin / unpin` 的归属是 **一级导航下的二级导航项状态**，不是独立模块，也不是 page-content 的内容。
- 未固定的二级导航默认只展示最近使用或最近访问的一小组；固定项用于突破该上限。

参考语义：

```txt
Messages
  XF Project        📌
  CCC
  Home
  Company
Workspaces
  jixoai/agenter    📌
  gaubee/blog       📌
  jixoai/openspecui
  github/keyApp
```

## 4) Chrome Window 契约

- `chrome-window` 必须有明确的窗口边框感。
- 圆角要克制，不能做成厚重卡片或大圆角浮层。
- 激活态 tab 与下方 `page-toolbar` 应当视觉连成一个连续表面。
- 激活态 tab 与 toolbar 之间 **不应有额外 bottom border**。
- toolbar 与 page-content 之间只允许一条干净的分割线；禁止双线、厚阴影、露底色。

### 4.1 Tabs

- tabs 是 `chrome-window` 的一部分，不可丢失、弱化或被 toolbar 结构吞掉。
- tabs 可以包含固定窗口、普通窗口和新建入口。
- 任何 toolbar 调整都不得破坏 tabs 的可见性与连续性。
- tab 标题优先使用短资源标题；避免在 tab 上重复写 `Workspace /`、`Avatar /` 这类系统前缀。

### 4.2 Page Toolbar

- toolbar 是固定高度。
- 即便承载两行信息，也必须在固定高度内完成，不允许靠加高规避设计问题。
- toolbar 的作用是组织页面身份、局部动作、视角切换与模式切换，不是堆文案说明。

## 5) Page Content 心智模型

- `page-content` 应被当作一个嵌入在 chrome-window 里的独立窗口内容区来设计。
- 可以假想这里嵌套了一个 iframe。
- `page-content` 自身必须显式建模横向装配关系，而不是依赖隐式定位。

因此：

- 不要在 page-content 里再套一层“整页大卡片”。
- 不要为了制造层次而额外堆大量 border、padding、background。
- 外层窗口感由 `chrome-window` 承担，内容区内部只表达真实工作内容的结构。
- **外层 framing 必须单一归属（single ownership of framing）**：一旦 `chrome-window` / `page-content` 已经承担页面外层边框、圆角、背景和外边距，route-local surface 不得再重复创建第二层外框。
- **避免冗余包裹（redundant framing）**：高密度工作区中的主阅读面、主检查面、主消息流，默认应直接复用外层内容表面，而不是再包一层 `card + rounded + border + shadow`。
- **优先保留内容密度预算（density budget）**：route-local padding 只有在确实承担新的分组语义时才成立；如果只是把主体内容再向内缩一圈，应视为浪费垂直与水平预算。
- **主 inspection surface 默认 edge-to-edge**：像 transcript、heartbeat、timeline、inspector 这类页面主表面，应尽量贴合共享内容区展开；除非需要表达新的层级，否则不要再人为制造“页面里的页面”。
- 当存在 `main-area + bottom-area + right-drawer` 时，`page-content` 应显式拥有这一横向装配权。
- `content-stack` 负责吃掉剩余宽度，`right-drawer` 和 `drawer-handle` 负责固定宽度。
- 禁止用固定总宽度、隐式绝对定位或“刚好拼满”的方式把内容区撑出来；否则窗口一旦变化就会出现裁切。

## 6) 系统页装配法则

不同系统页面应共享同一套页面物理法则，只改变主体内容语义。

- 系统页默认遵守：
  - 上半部分作为主信息区，空间更大
  - 下半部分承载辅助信息、编辑器或局部操作
  - 右侧 drawer 承载更详细、更高级、更低频的信息
- toolbar 负责页面身份、视角切换、模式切换和页面级动作。
- page-content 负责真正的工作流内容，不把导航逻辑重新堆回主体。
- 当页面已经拥有 `right-drawer` 作为细节区时，`main-area` 默认不再重复造一个右侧 detail pane。
- 像 `Explorer / Rules / Private` 这类会改变主体内容结构的模式，应优先放入 toolbar 第二行，而不是把其中一个模式硬塞进 bottom-area。
- 同一页面的多种内容模式应尽量共享同一个 content header；像 `View as`、workspace path 这类上下文事实，不应在 `Explorer / Rules / Private` 之间重复发明不同头部。
- 大型树和长列表必须显式表达交互事实：节点可展开/折叠、列表已虚拟化、默认只展示一部分结果，以及 `load more` 如何出现。
- 密集型 `right-drawer` 默认使用“分节标题 + 轻量 divider + 底部事实区”的组织方式，而不是把每个信息块都做成独立 card。
- 解释行为、使用限制、fallback 这类辅助信息，默认使用 `HelpHint` 这类紧凑提示原语承载；不要把页面主体写成一段段“说明书”。
- `Preview` 必须按能力分型：文本默认走 `CodeMirror` 风格阅读面；图片/音频/视频走现代化轻量媒体预览；不支持预览的类型必须明确进入 `No preview` 状态，而不是留白或渲染错误内容。

例子：

- 某些页面的主信息区可能是文件树、消息流、Attention context 或终端内容。
- 某些页面的下半区可能是输入器、规则面板、操作台或状态摘要。

## 7) Toolbar 设计法则

- toolbar 的图标位于 **toolbar 的 inline-start**，不是第一行局部内容的一部分。
- toolbar 可以在固定高度内容纳两行内容，但必须是高密度、紧凑排版。
- 第一行承担：
  - 页面身份
  - 轻量状态
  - 页面级快捷动作
- 第二行承担：
  - 视角切换
  - 模式切换
  - 局部语义过滤

### 7.1 Toolbar 右侧动作

- 右侧动作应默认出现在 **第一行**。
- 不要把右侧动作拆成上下两行，否则会造成信息归属混乱。
- 右侧动作优先使用 **icon-buttons**，而不是文本按钮。
- 当空间有限时，icon-button 默认不加边框，避免进一步切割视觉内容。
- 右侧动作集合必须由当前模式决定，而不是给整页硬塞一套固定按钮；例如有些模式提供 `preview / inspector` 切换，有些模式只提供搜索或新增。

### 7.2 Toolbar 第二行

- 第二行默认重点在左侧。
- 第二行不应再复制一个“右半区动作带”。
- 第二行的控制项更适合用 pills / segmented controls 表达视角和模式切换。
- `workspace` 页的第二行优先承载 page-level mode switch，例如 `Explorer / Rules / Private`。
- `View as` 这类 avatar 视角切换属于 shared content header，不应再占据 workspace toolbar 第二行。

### 7.2.1 Toolbar 身份表达

- toolbar 第一行左侧优先展示短 identity，再辅以轻量 subtitle；不要把这里做成“系统名称 + 说明书副标题”。
- 像 `default + workspace view`、`gaubee + avatar runtime` 这类短 identity 结构，优先于 `Workspace System`、`Avatar Detail` 这类泛化标题。

### 7.3 Toolbar Search

- 页面级搜索优先从 toolbar 右侧的搜索按钮 **就地展开**，形成一个紧凑的 find control，而不是再弹出一个脱离上下文的独立面板。
- find control 默认包含：
  - query input
  - 当前命中计数
  - `prev / next / cancel` 三个紧凑动作
- find control 的视觉位置应与原搜索 icon 的点击位置连续，接近浏览器原生页内查找的心智模型。
- 页面级搜索的结果高亮应被视为内容层投影，而不是新的列表筛选 UI；高亮、跳转与取消应围绕当前页面内容工作。

## 8) 视觉收口纪律

- 不要用更厚的 border 去“解释结构”。
- 不要用更多阴影去“补结构问题”。
- 不要把每一块次级信息都包成 card；信息一多，线条、边框和间距会快速失控。
- `metadata`、补充说明、低频状态默认优先使用轻量分隔、留白或单条 divider，而不是新的 card/border 容器。
- 当 `right-drawer` 同时承载 inspection 与 summary 时，inspection 内容优先放上方连续阅读，summary facts 优先停靠底部，而不是在中间穿插新的卡片堆。
- 头像或图标一旦放进带 border 的容器，必须满足 **同心内缩（concentric inset）**：内容到 `top/right/bottom/left` 的视觉内边距保持一致，确保内外轮廓同心，不出现偏上、偏下、偏左、偏右的漂移。
- 当出现 `border` 套 `border`、头像套外环、图标套圆形按钮这类结构时，每一层都必须继续遵守 **同心内缩**；禁止只让最外层居中、内层再靠经验值微调。
- 这条规则适用于 circle、pill、rounded-rect 等一切“有外轮廓包裹图标/头像”的控件；尺寸应从外轮廓向内推导，而不是靠局部魔法 padding 修视觉。
- `View as`、avatar selector、workspace selector 这类带头像的紧凑选择器，默认视为 **concentric inset control**；头像既要和自身外环同心，也要和整个控件外轮廓保持一致的首段内缩。
- 当出现两条分割线、粗阴影、露底色时，优先检查容器高度、对齐关系和层级，而不是继续叠样式。
- 当 header 子树被频繁 patch 后出现异常时，优先重建干净壳层，再把内容迁回去。

## 9) 设计过程纪律

- **先看真实页面，再定稿**：设计前先用真实应用页面作为母版和密度基线。
- **Pencil 持久化优先**：开始多轮设计前，先为当前 change 打开仓库内可持久化的 `.pen` 文件，不要把关键设计状态只留在临时文档里。
- **基线稿与补充稿分离**：一旦某轮设计已经过人工校验并成为阶段性真源，就应在同一 `.pen` 文件中保留独立的 baseline 区域；后续补充稿、实验稿、响应式变体不得直接覆盖这块基线。
- **恢复稿必须标注 provenance**：当一次恢复同时涉及“壳层法则”和“页面内容骨架”时，必须明确写清楚哪部分来自 shell baseline，哪部分来自 content baseline；禁止凭记忆把相邻批次的设计混成一稿。
- **组件从基线提炼，不从猜测稿提炼**：共享组件库必须优先从已校验的 baseline 反向抽取；不要先做一套“看似合理”的组件，再反过来逼页面去适配它。
- **评审稿可以扁平，组件库必须并存**：为了稳定截图与导出，评审用整屏稿可以保持扁平化；但同一 `.pen` 文件里应同时存在与其配套的 reusable component shelf，避免重复复制成为默认工作方式。
- **先做桌面单页验证**：当整体方向还没定，不要同时展开平板和手机。
- **先让壳层稳定，再修内容**：先收敛 tabs / toolbar / page-content 的边界，再打磨文案与按钮。
- **共享壳层先组件化**：一旦 `sidebar / tabs / toolbar / shared header / drawer` 这类中等粒度原语稳定，就优先抽成可复用设计组件；不要继续靠整屏复制维持多端一致性。
- **设计资产固定分三层**：默认使用三层 `.pen` 结构：
  - `design/design-system.pen`：原子级、正交、durable 的 design-system 组件；允许保留少量精修 demo/composite。
  - `design/webui/components.pen`：跨 route 复用的 WebUI 壳层与部件。
  - `design/webui/<route>.pen`：按路由拆分的 route-local 部件与评审稿，例如 `workspaces.pen`、`avatars.pen`。
- **页面部件跟着 route 走**：只有跨 route 真正共享的部件才允许提升到 `design/webui/components.pen`；某个页面专属的 header / toolbar / drawer 变体默认留在对应 route `.pen` 中。
- **路由拆分优先于业务混放**：评审稿按路由能力拆分，不把多个系统页面重新混回一个“大一统”的 `webui.pen`。
- **跨文件复用必须是真复用**：Pencil 一旦支持 `imports + namespaced ref` 的跨文件组件引用，就优先使用它复用稳定部件，而不是复制一份后再局部 patch。
- **组件库按 family 行式排布**：组件库默认采用左对齐的纵向行式排布；一行只承载一个 component family，family 的不同变体沿水平方向展开，避免再用多列杂糅式 shelf。
- **设计资产真源默认放在 `design/`**：`openspec/changes/*` 负责记录契约、决策与任务；持续迭代的 Pencil 资产默认放在仓库 `design/` 目录下，而不是继续把长期设计真源留在 change 目录里。
- **小步验证**：每次只改一小段结构，并立即截图复查。
- **优先自检而不是猜测**：出现视觉异常时，先看截图和布局快照，再决定是结构问题还是样式问题。

## 10) 后续扩展纪律

- 当桌面端壳层法则未稳定前，不要提前展开移动端视觉细节。
- tablet / mobile 的布局可以自适应重排，但必须继承相同的信息架构与能力路径。
- 当水平空间不足时：
  - `left-sidebar` 可以收拢为 compact shell / drawer trigger
  - `right-drawer` 可以转译为 page-content 末尾的 stacked sheet
  - 但 `chrome-window`、toolbar 模式切换、shared content header、main-area / bottom-area / detail-surface 的职责不能丢
- 当 compact toolbar 的模式标签在小屏中装不下时，可以做 **语义保持的缩写**（例如 `OpenTelemetry -> OTel`），但模式切换路径本身不能被隐藏成不可达状态。
- `tablet landscape` 默认比 `tablet portrait / phone` 更晚丢失 persistent sidebar 和 persistent right-drawer；优先保留双栏工作感，实在不够再收拢。
- 后续新增系统页面时，优先回答三个问题：
  - 它在 sidebar 中如何出现？
  - 它在 chrome-window 的 toolbar 中如何表达页面身份与局部动作？
  - 它在 `main-area / bottom-area / right-drawer` 中如何分配主次信息？

## 11) 组件交互与视觉伪影纪律 (Affordance & Artifacts)

- **设计图只画物理占位 (Document Flow)**：诸如 Tooltip、Popover、Dropdown 等脱离正常文档流、不占用实际布局空间的悬浮层（Portal），**严禁**在主要布局画板（如 `webui/*.pen`）中作为常规节点“硬塞”进 Flex 布局，这会严重破坏 `padding` 与 `gap`。
- **使用原子触发器 (Atomic Triggers)**：像 `HelpHint` 这样的提示，在画板中只允许放置其 `20x20` 的圆圈 Trigger (`?`)，绝不能画一个带文字的白盒子挤占页面空间。相关的提示文案，必须写入对应 change 的 `spec.md` 中。
- **需要展示悬浮规范时**：必须在专门的原子组件画板（如 `design-system.pen`）中单独建立一个 "Open State" 组合画板（Trigger + Popup），以展示它的圆角和阴影规范；绝不在全局页面中满屏飞气泡。

## 12) 预览视口与隔离架构 (PreviewPort & Isolation)

- **预览即隔离 (Isolation by Default)**：所有的文件内容预览（Text, Image, Video, Unknown 等）必须通过 `PreviewPort` 承载，底层实现强制使用沙箱化的 `<iframe>` 对接到 `/fileviewer?path=...`。
- **UI 只负责 Port 的物理占位**：在设计稿和实现中，预览区不再硬编码特定格式的编辑器（如 CodeMirror）或播放器。UI 只负责提供一个稳定的、背景纯净的 Port 容器。
- **状态由 Port 接管**：Preview 区域的 Loading、Error 以及 Unknown Fallback 样式由 Port 统一调度。设计稿应专注于 Port 与 Metadata 之间的布局关系，而非预览内容本身的渲染细节。
