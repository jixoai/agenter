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
- `page-content` 的 page-level scroll owner 固定属于 shared window body；tabs 与 toolbar 永远在这个 scroll viewport 之外。

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
- 当 compact right detail 打开时，toolbar 只允许被共享 shell 临时接管为 `close-only` affordance；这是一种 view visibility contract，不是把 detail surface 自己再复制一套 header/actions 进 toolbar。

### 4.2.1 Shared Page Toolbar Law

- `page-toolbar` 必须被视为共享平台原语，而不是每个 route 自造一套 header DOM。
- `chrome-window` / `chrome-page-toolbar` 永远只有一个 toolbar owner；禁止 local toolbar、portal toolbar、detail takeover 同时叠两套页面 header。
- 默认术语固定为：
  - `chrome-tabs`：窗口级 tabs
  - `page-tabs`：toolbar 内的页面局部 tabs
  - `page-anchor`：toolbar 左侧永远留在主界面的核心区域
  - `page-content`：URL 驱动的主体内容区
- `page-anchor` 的切换规则固定：
  - 有 `page-tabs` 时，`page-anchor = page-tabs`
  - 无 `page-tabs` 时，`page-anchor = identity`
- tabs 是唯一允许横向滚动的 toolbar 区域；`chrome-tabs` 和 `page-tabs` 都可以滚动，但都不得被塞进 overflow panel。
- toolbar 左侧和右侧的职责固定：
  - 左侧：`page-anchor + identity`
  - 右侧：`actions + status + overflow-trigger`
- `overflow-trigger` 只在存在真实 omitted content 时出现；不能因为 breakpoint 命中就机械显示一个点不开的“更多”按钮。
- overflow 是锚定 toolbar 的浮层面板，不是 `DropdownMenu` 语义，也不是会挤压 `page-content` 的 inline section。
- overflow panel 里只重排那些被折叠出去的内容；已经常驻主界面的 `page-anchor` 不得再重复投影进面板。
- toolbar host 不得使用 `overflow: hidden` / `overflow: clip` 裁掉共享 overflow panel；页面裁剪、滚动和浮层层级必须分开建模。

## 5) Page Content 心智模型

- `page-content` 应被当作一个嵌入在 chrome-window 里的独立窗口内容区来设计。
- 可以假想这里嵌套了一个 iframe。
- `page-content` 自身必须显式建模横向装配关系，而不是依赖隐式定位。
- `page-content` 默认先拥有一个 shared body scroll viewport；route-local root 只负责内容装配与 stretch，不负责重新发明页面级滚动。

因此：

- 不要在 page-content 里再套一层“整页大卡片”。
- 不要为了制造层次而额外堆大量 border、padding、background。
- 外层窗口感由 `chrome-window` 承担，内容区内部只表达真实工作内容的结构。
- **外层 framing 必须单一归属（single ownership of framing）**：一旦 `chrome-window` / `page-content` 已经承担页面外层边框、圆角、背景和外边距，route-local surface 不得再重复创建第二层外框。
- **避免冗余包裹（redundant framing）**：高密度工作区中的主阅读面、主检查面、主消息流，默认应直接复用外层内容表面，而不是再包一层 `card + rounded + border + shadow`。
- **优先保留内容密度预算（density budget）**：route-local padding 只有在确实承担新的分组语义时才成立；如果只是把主体内容再向内缩一圈，应视为浪费垂直与水平预算。
- **主 inspection surface 默认 edge-to-edge**：像 transcript、heartbeat、timeline、inspector 这类页面主表面，应尽量贴合共享内容区展开；除非需要表达新的层级，否则不要再人为制造“页面里的页面”。
- 当存在 `main-area + bottom-area + right-drawer` 时，`page-content` 应显式拥有这一横向装配权。
- route-local 根容器允许使用 `min-h-full` 等 stretch 语义让内容贴合 shared body，但不得用 `h-full`、隐藏裁剪或第二层整页 scroll 把外层 body 锁死。
- `content-stack` 负责吃掉剩余宽度，`right-drawer` 和 `drawer-handle` 负责固定宽度。
- 禁止用固定总宽度、隐式绝对定位或“刚好拼满”的方式把内容区撑出来；否则窗口一旦变化就会出现裁切。
- 当 `right-drawer` 需要在 desktop 与 compact 间切换时，这个切换必须由共享 split-detail primitive 根据容器宽度推导，而不是由 page-local viewport breakpoint 猜测。
- desktop split 的 resize state 必须以 ratio 持久化，而不是记像素宽度；这样窗口变化时 left/right intent 才能保持稳定。
- 如果 route 内还需要第二个滚动区，例如 terminal stage、长列表 pane 或 detail inspection surface，必须显式声明那个次级 scroll owner；不要让 shared body scroll 和 route-local stage scroll 互相抢所有权。

### 5.1 Dense Record Surfaces

- 当页面承载大量可生成记录的 surface（例如 transcript、heartbeat、timeline、inspector rows）时，列表层只承担稳定摘要，不承担完整详情。
- 列表主单元优先使用 `RecordCard` 语义：时间、状态、类型、过程摘要是第一序列；可选叙事、长文本和完整参数应进入 detail。
- 同类型记录的卡片高度必须稳定；可选字段缺失时，应通过布局补位或收纳保持视觉平衡，而不是靠高度抖动表达差异。
- 用户面对的主词优先是 `record` / `RecordCard`；`group` 这类词可以保留给数据投影层，不应成为主视觉词。
- 详情层以 chips-line rail 作为主导航，时间信息分布在线上而不是塞进卡片正文。
- 当空间宽裕时，导航 rail 可以完整展开为 chip + time + chip；当空间收紧时，优先压缩中段统计，而不是切换成另一套布局语言。
- 详情层的时间线可以用双线表达：外线承载时间与渐变，内线连接 chip 节点；两条线的职责不要混写。
- 如果一条信息已经被一层视觉元素清晰表达，就不要在同一行里重复渲染同一种事实。

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
- `Skills` 页的内容模式不是单一浏览器模板：
  - `shared / built-in / global` = generic skill-list-first 的 accordion list-detail
  - `avatars` = avatar-list-first overview，detail 只预览 workspace-grouped avatar-private skills
  - dedicated avatar tab = workspace-grouped file tree browser
- `Skills` 的 tab 顺序不是视觉偏好，而是 override law 的可视化：`shared < built-in < global < avatar-private`。默认路由落在第一个 tab，旧 query key 只能做 canonical redirect，不能长期双写。
- `Skills` 的移动端不发明第二套 preview 页面；compact 情况默认复用共享 split-detail 的 detail drawer / close ownership。

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

### 7.0.1 Structured Toolbar Template

- 默认 template 是一个共享两行 grid，而不是每页自由拼 flex：
  - 第一行：`page-anchor icon title ... actions`
  - 第二行：`page-anchor icon subtitle ... status`
- `actions` 是微动作，不是普通大按钮列；inline 态必须极度克制，只有进入 overflow panel 才恢复成常规按钮语义。
- `status` 应被视为克制信号，而不是第二套 action row；优先挂在 identity title 的 inline-end，或在确有必要时占用右侧次级位置。
- 有 `page-tabs` 的页面中，collapse 顺序固定是：
  - `status/actions`
  - `subtitle`
  - `identity`
- 无 `page-tabs` 的页面中，`identity` 必须常驻主界面，允许截断，但不得整体消失或迁入 overflow panel。
- 页面如果只需要 `page-tabs + actions`，应直接省略 `identity/status`，而不是再补一套重复的标题条。

### 7.1 Toolbar 右侧动作

- 右侧动作应默认出现在 **第一行**。
- 不要把右侧动作拆成上下两行，否则会造成信息归属混乱。
- 右侧动作优先使用 **icon-buttons**，而不是文本按钮。
- 当空间有限时，纯 icon-only 的次级 toolbar action 可以默认不加边框，避免进一步切割视觉内容。
- 这条规则 **不适用于** `variant="outline"` 的显式按钮，也不适用于 `icon + text` 的可点击动作；这两类控件仍然必须保留可见边框来表达 click affordance。
- 右侧动作集合必须由当前模式决定，而不是给整页硬塞一套固定按钮；例如有些模式提供 `preview / inspector` 切换，有些模式只提供搜索或新增。

### 7.2 Toolbar 第二行

- 第二行默认重点在左侧。
- 第二行不应再复制一个“右半区动作带”。
- 第二行的控制项更适合用 pills / segmented controls 表达视角和模式切换。
- `workspace` 页的第二行优先承载 page-level mode switch，例如 `Explorer / Rules / Private`。
- `View as` 这类 avatar 视角切换属于 shared `page-toolbar` 的 `status` / overflow 集群，不应再留在 workspace content header 或 route body 中重复出现。
- `page-toolbar` 自带响应式折叠与 overflow panel；同一组 route-local controls 必须声明一次后交给 shared toolbar 编排，而不是再手写 desktop/mobile 两套变体。

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
- 当页面目前无法做到“从搜索 icon 就地展开”的完整 find experience 时，仍应先把 query input、match count、`prev / next / cancel` 组织在共享 `page-toolbar` 右侧 action cluster 中，而不是退回 route-local header。

## 8) 视觉收口纪律

- 不要用更厚的 border 去“解释结构”。
- 不要用更多阴影去“补结构问题”。
- 不要把每一块次级信息都包成 card；信息一多，线条、边框和间距会快速失控。
- 去装饰化只针对被动 surface，不针对可点击按钮；`outline` 按钮、显式 action button、icon+text button 的边框属于 affordance 语义，不得为了“更轻”而抹掉。
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
  - `right-drawer` 可以转译为 page-content 末尾的 stacked sheet，但必须沿用同一个 split-detail law、同一个 close ownership、同一个 detail 语义，而不是另外发明一套 mobile-only 页面
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

- **隔离是 preview shell 的默认法则**：所有 file preview 都进入同一个 iframe shell，而不是由主 workbench 自己渲染一部分、再把另一部分外包出去。
- **隔离入口固定为 `filePreviewer`**：WebUI 的 file preview 统一嵌入 `filePreviewer.html`，主应用只负责选择、metadata、容器和 empty/error framing，不在 route tree 里直接持有 CodeMirror/pdf.js/media player 的清理负担。
- **允许 preview 子页面风格弱耦合**：`filePreviewer` 优先复用成熟技术库并保持可快速开发，不要求和主应用完全同皮肤；主应用只保证外层容器、toolbar 语义和 preview metadata 的一致性。
- **渲染器与壳层分离**：`filePreviewer` 是 preview shell，不是某一种 renderer；text-like file 默认用 CodeMirror source preview，内容型 Markdown 可以通过显式 projection 进入 document preview，pdf 用 pdf.js，image/audio/video 用各自成熟 renderer，unsupported 也在同一 shell 内明确表达。
- **状态边界必须清晰**：主 workbench 负责 empty/selection framing 与外层 metadata；`filePreviewer` 负责其内部的 loading/render/error/unsupported state。设计稿应专注于 Port 与 Metadata 的布局关系，而不是把 preview 内部 chrome 再复制到主页面。
