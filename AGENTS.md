# AGENTS Best Practices

本项目测试策略从 **TDD 升级为 BDD**，并作为默认工程实践。

## 1) 核心原则

- 以行为为中心：先描述“用户/系统行为”，再写实现细节。
- 测试即文档：测试名称要能直接表达业务意图与验收标准。
- TDD 仍保留：作为 BDD 场景落地时的实现手段（红-绿-重构）。

## 2) 标准流程（BDD-First）

1. 先写行为场景（Feature / Scenario），明确验收边界。
2. 用 Given / When / Then 结构编写失败测试（Red）。
3. 实现最小代码使场景通过（Green）。
4. 在不改变行为的前提下重构（Refactor）。
5. 补充回归场景，防止行为漂移。

## 3) 测试分层（只保留高价值）

- **E2E**：跨进程/跨包关键链路（如 CLI -> daemon -> ws/http）。
- **Integration**：模块协作与协议边界（runtime、registry、protocol）。
- **DOM Contract**：WebUI 交互组件优先使用 **Storybook v10 + Vitest**，以 stories 作为组件状态真源，用真实 DOM 场景覆盖输入、弹层、列表、组合面板。
- **Unit**：纯逻辑与算法规则（解析、映射、状态机）。

约束：

- 避免对实现细节做脆弱断言（私有字段、内部顺序等）。
- 优先断言“可观察行为”和“稳定契约”。
- 低信号高耗时用例应移除或下沉为更小范围测试。

## 3.1) Storybook DOM 测试最佳实践

- **官方组合**：`Storybook v10 + @storybook/react-vite + @storybook/addon-vitest + Vitest`。
- **单一真源**：组件状态先写成 stories，再由 Vitest 通过 `composeStories(...).run()` 执行，避免 story 与 test 双份夹具漂移。
- **真实交互优先**：输入、弹窗、手风琴、列表选择、快捷操作等 UI 行为，优先放到 Storybook DOM 测试而不是只用 mocked jsdom。
- **BDD 落点**：story 命名表达稳定场景，Vitest 用 `Feature / Scenario` 命名行为断言。
- **边界分工**：
  - 纯算法/解析：继续走 unit/jsdom；
  - 组件真实交互：走 Storybook DOM；
  - 跨页面/跨进程链路：走 Playwright E2E。
- **实现方式**：优先在 story 的 `play` 中描述用户行为与断言，再在 `test/storybook/*` 中以 `Story.run()` 复用。
- **回归入口**：WebUI 至少维护 `bun run --filter '@agenter/webui' test:dom` 作为高价值 DOM 回归入口。
- **串行执行纪律**：`Vitest browser`、`storybook dev`、`storybook:build` 不能并行运行；需要串行执行，避免浏览器会话与 Vite 端口资源冲突。

## 3.2) Storybook DOM 技能手册（上下文清空后直接照做）

### 3.2.1 目标

- WebUI 组件的“真实交互”优先通过 Storybook stories 描述，再由 Vitest 在浏览器里执行。
- stories 是组件交互状态的**单一真源**；不要再额外复制一份复杂测试夹具。
- 这套方案主要解决 `CodeMirror`、弹窗、手风琴、虚拟列表、组合面板这类 jsdom 容易失真的问题。

### 3.2.2 当前仓库约定

- Storybook 配置目录：`packages/webui/.storybook/`
- Storybook 主配置：`packages/webui/.storybook/main.ts`
- Storybook 全局预览：`packages/webui/.storybook/preview.tsx`
- Storybook + Vitest 初始化：`packages/webui/.storybook/vitest.setup.ts`
- Vitest 配置：`packages/webui/vitest.config.ts`
- stories 位置：优先与组件同目录，命名为 `*.stories.tsx`
- Story 驱动的 DOM 测试位置：`packages/webui/test/storybook/*.test.tsx`

### 3.2.3 命令

```bash
bun run --filter '@agenter/webui' storybook
bun run --filter '@agenter/webui' storybook:build
bun run --filter '@agenter/webui' test:unit
bun run --filter '@agenter/webui' test:dom
bun run --filter '@agenter/webui' test
```

- `test:unit`：保留 jsdom/unit 层，适合纯逻辑与轻交互。
- `test:dom`：运行 Storybook + Vitest browser tests，适合真实 DOM 交互。
- `test`：同时回归 unit + DOM contract。

### 3.2.4 什么时候该写 Storybook DOM 测试

满足任一条件就优先写 story-driven DOM test：

- 组件依赖真实浏览器行为：`CodeMirror`、selection、focus、clipboard、drag/drop。
- 组件含弹层：`Dialog`、`Sheet`、`Popover`、`Tooltip`。
- 组件是复杂组合：Chat 行渲染、Workspace/Session 列表、Master-Detail 页面。
- 组件行为需要“用户步骤”才能表达清楚。

以下情况继续留在 unit/jsdom：

- 纯解析函数
- 纯状态映射
- 无浏览器依赖的渲染分支

### 3.2.5 标准写法

1. 先给组件写 `*.stories.tsx`。
2. story 的 `args` 提供最小稳定夹具。
3. story 的 `play` 负责描述用户行为与断言。
4. 在 `test/storybook/*.test.tsx` 中用 `composeStories(...).run()` 复用 story。
5. test 名称必须继续使用 `Feature / Scenario / Given-When-Then`。

推荐结构：

```ts
import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";
import * as stories from "../../src/features/chat/AIInput.stories";

const { SubmitDraft } = composeStories(stories);

describe("Feature: Storybook DOM contract for AI input", () => {
  test("Scenario: Given a draft story When Enter is pressed Then submission clears the real CodeMirror surface", async () => {
    await SubmitDraft.run();
  });
});
```

### 3.2.6 断言原则

- 优先断言**用户可见结果**，不要断言内部实现。
- 优先断言：
  - 按钮是否可点/禁用
  - 对话框是否打开
  - 选择状态是否切换
  - 文本/结构化内容是否真正显示
- 避免断言：
  - 私有 class 细枝末节
  - 临时 DOM 顺序
  - 内部状态对象

### 3.2.7 当前已验证可行的组件类型

- `AIInput`：Enter 提交、`@` 路径补全、图片预览
- `ChatPanel`：tool_call/tool_result 合并后的展开行为
- `WorkspaceSessionsPanel`：单击选中、再次单击取消、Resume 动作

### 3.2.8 经验结论（重要）

- mocked jsdom 通过，不代表真实 DOM 会通过；`CodeMirror` 就是典型例子。
- Storybook DOM 测试应被视为 WebUI 的**BDD 主战场**，而不是装饰性文档。
- 如果真实 DOM 测试失败，优先修组件真实行为，不要为了通过测试去改弱断言。

## 3.3) WebUI 双端 viewport 契约

- **桌面端 + 移动端都是强制验收项**：WebUI 走查、Playwright E2E、关键 shell/layout 回归，默认都必须同时覆盖 desktop 和 mobile，不能只看桌面端。
- **移动端默认基线**：统一使用 `iPhone 14` 作为默认移动端环境；本项目当前的强制移动 viewport 基线就是 `390px` 宽。
- **Playwright 默认双 project**：`packages/webui` 的 E2E 默认必须跑 `desktop-chromium` + `mobile-iphone14`；单 project 只允许本地调试，不算最终验收。
- **验收按能力，不按 DOM 同构**：桌面与移动可以有不同导航结构（如 sidebar vs sheet / tabs vs bottom nav），但关键能力与主路径必须双端都可达、可操作、可观察。
- **高风险面板补 compact stories**：Quick Start、Workspace shell、Chat、Devtools、Settings 这类在移动端会折叠、重排或切换导航方式的界面，默认需要至少一个 compact Storybook DOM contract。

## 4) 命名规范

- `describe("Feature: ...")`
- `test("Scenario: Given ... When ... Then ...")`

示例：

- `Feature: CLI daemon lifecycle`
- `Scenario: Given daemon is running When doctor checks health Then exit code is 0`

## 5) 完成标准（DoD）

- 新功能至少包含一个行为场景测试。
- 关键路径变更必须有 e2e 或 integration 覆盖。
- `bun run typecheck` 与 `bun run test` 必须通过。
- 文档（SPEC/README/AGENTS）与行为保持一致。

## 6) 用户协作方法论（必须遵守）

- **先证据后结论**：先跑真实流程（CLI/TUI/WebUI/Browser），再下判断；不凭主观猜测解释问题。
- **保持客观展示**：AI 输出不做“语义篡改/清洗/特化”；UI 只做结构化呈现。
- **国际化单一真源**：业务层不硬编码文案；统一通过 i18n 包与配置加载。
- **配置优先于硬编码**：模型、终端入口、提示词路径、策略等一律走 settings/prompt sources。
- **架构做减法，算法做加法**：先保证路径直觉、最小可用，再增强算法与可观测性。
- **循环系统哲学**：LoopBus 持续空转；仅在有效输入（用户输入、终端变更、待办任务）到来时触发 AI 调用。
- **LoopBus 等待模型**：统一使用 `waitCommitted(fromHash)` 等待各子系统输入；任一输入 resolved 后，固定再等 `loopWaitMs=300ms` 再 collect。
- **Waiter 清理纪律**：`Promise.race` 的 losers 必须 reject/cancel，避免 listener / waiter 泄漏。
- **Session DB 只存事实**：`session.db` 只落 `session_head/session_cycle/model_call/session_block/loopbus_trace/api_call` 这类事实，不落可推导 snapshot/state-log。
- **多终端聚焦**：默认支持多 focused terminal；每个 focused terminal 都独立注入 terminal input，unfocused 仅保留 dirty 状态。
- **Provider 请求纯度**：provider request body 只保留真实 HTTP/model 参数；`collectedInputs` 之类循环事实必须写入 `session_cycle`。
- **Provider 建模双轴化**：`apiStandard` 只表达传输/协议契约；`vendor/profile/extensions` 只表达厂商兼容与增强，禁止再用 vendor 名称替代协议分发。
- **功能层次化呈现**：主界面聚焦聊天与任务推进；进阶能力放入侧栏/工具面板，不堆叠在主视图。
- **问题定位分层实验**：先隔离运行时（PTY/Terminal），再隔离渲染层（xterm/headless/web），逐层缩小问题面。

## 7) Browser 走查标准（agent-browser）

### 7.1 固定流程

1. 先走 **desktop**，再走 **mobile**
2. `agent-browser open <url>`
3. `agent-browser wait --load networkidle`
4. `agent-browser snapshot -i`
5. 交互后重新 `snapshot -i`
6. `get text body` + `screenshot --full` 记录证据

补充约束：

- **双端硬约束**：WebUI 浏览器走查必须同时产出 desktop 和 mobile 两份证据。
- **默认移动端设备**：若无特别说明，mobile 一律按 `iPhone 14` 的 viewport/safe-area/touch 环境走查。
- **路径必须真实**：移动端必须走真实 compact 导航路径（如 `Open navigation`、drawer、bottom nav），不能用桌面端捷径替代移动端交互。

### 7.2 默认回归用例（WebUI）

- **Case A / 启动可用性**：页面加载成功，关键入口可见（New session / Select workspace / Chat 输入框）。
- **Case B / 会话创建**：可创建 session，主聊天区进入可输入状态。
- **Case C / 对话链路**：发送消息后，能看到可观察的状态推进与最终 assistant 回复。
- **Case D / 错误可见性**：当终端/模型失败时，界面出现明确错误信息，且可继续操作。

附加规则：

- 上述用例默认都要在 desktop 和 mobile 各执行一遍。
- 若 desktop 与 mobile 的导航方式不同，测试用例必须分别按各自真实入口执行。

### 7.3 结果判定

- 每个用例都要记录：`预期`、`实际`、`证据路径`、`是否通过`。
- 不通过时必须附带最小复现步骤与日志位置。
- 结果记录必须显式标注 viewport：`desktop` 或 `mobile`。

## 8) WebUI 布局最佳实践（Flex）

- **禁止使用 `min-h-0`**：在本项目 WebUI 中不再使用该 class 处理滚动/压缩。
- **`overflow-hidden` 不是默认布局工具**：禁止把 raw `overflow-hidden` 当作修复 flex/scroll 的通用手段；先修正布局层级与滚动所有权。
- **移除 hidden 必须补 scroll owner**：一旦去掉祖先 `overflow-hidden`，必须同步为真正的内容区补上显式滚动拥有者；对 surface 级内容优先使用 `ScrollViewport`，不能只“去掉裁剪”却不恢复滚动。
- **布局壳层禁止 raw clipping**：shell、route wrapper、panel wrapper 这类 layout surface 不允许直接写 raw `overflow-hidden`；应用级视口裁剪必须走 `ViewportMask`。
- **主滚动区显式化**：每个 major panel 只允许一个主滚动区，并且必须通过 `ScrollViewport` 表达，而不是在祖先和子孙同时混用 `overflow-auto/hidden`。
- **Flex/Grid 不会自动变成滚动层**：当内容区位于 `flex-1`、`grid` 的 `minmax(0,1fr)` 行列中时，仍然必须显式声明 `overflow-auto` 或 `ScrollViewport`；“高度对了”不等于“能够滚动”。
- **视觉裁剪单独建模**：圆角媒体、终端窗口、Markdown/code surface 这类明确的视觉裁剪，统一使用 `ClipSurface`；不要把视觉裁剪和布局约束混在一个容器里。
- **动画裁剪例外最小化**：只有像 `Accordion` 这种 animation primitive 允许保留 raw `overflow-hidden` 作为过渡 mask；新增例外必须先抽象成 primitive，再更新 allowlist。
- **滚动容器单点定义**：每个面板只保留一个主滚动区，避免多层嵌套滚动导致内容挤压与重叠。
- **背景色必须有语义所有者**：`bg-*` 只允许出现在 semantic surface、交互控件、内容可视化块上；shell/layout wrapper 不得直接拥有 raw 背景色。
- **先定 surface，再定 padding**：需要圆角、阴影、背景时，先抽象为 `surfaceToneClassName(...)` 或 surface primitive，再决定内部 padding；禁止在 layout 容器里同时混入 `bg-* + rounded-* + shadow-*`。
- **裁剪与背景默认解耦**：`ClipSurface` 负责裁剪，semantic surface 负责背景；只有媒体/终端这类必须“裁剪即填充”的内容，才允许同一容器兼有二者。
- **谁裁剪，谁解释原因**：只有明确的内容 surface 才能同时拥有 `border-radius + clip + fill`；layout wrapper 只负责排布，不得顺手接管视觉裁剪。
- **移除裁剪必须恢复滚动语义**：如果去掉某层 `overflow-hidden/ViewportMask/ClipSurface`，必须同步确认滚动是否仍有单一 owner；“视觉问题修了但内容不滚动”视为回归。

## 8.1) Apple 风格信息架构（WebUI）

- **先分层，再做样式**：先确定 `App Shell / Workspace Shell / Route Surface / Content Body` 的职责，再决定视觉表现；不要靠改颜色和圆角掩盖信息重叠。
- **单层单责**：`AppHeader` 只负责全局定位与全局导航；`WorkspaceShell` 只负责 workspace 上下文与 route 切换；`Chat/Devtools/Settings` 自己负责局部动作与局部提示。
- **GlobalSettings 只属于全局导航**：`GlobalSettings` 入口固定属于左侧导航或 compact drawer 这种 app-level navigation；禁止把它塞进 workspace route surface、`TopHeader`、`AppHeader` 右上角之类页面局部 chrome。
- **TopHeader 只属于当前页面**：`TopHeader/AppHeader` 只能表达当前页面的位置、上下文、局部导航和局部状态；禁止承载全局入口、全局设置、全局账号切换这类 app-level 能力。
- **相邻层禁止重复事实**：同一个 path、title、status、action 只能在一个层级表达一次；如果某信息已在 workspace bar 展示，就不能在 header 和 route card 再展示一次。
- **正常状态要安静**：被动状态优先使用低强调文本，而不是不断堆 chip；chip 只用于需要快速扫描的稀缺状态，不是默认文案容器。
- **异常状态要升级**：warning/error 不要混进 header 文本流；优先使用 banner 或独立 notice surface，让异常和正常信息分层。
- **一个区域只允许一个主动作**：每个 surface 只能有一个最重要的 primary action；像 Start/Stop 这种互斥能力，必须合并为一个状态驱动的动作入口。
- **菜单不能重复当前可见能力**：drawer、dropdown、context menu 只承载“当前层唯一额外能力”；如果某导航或动作已经在页面中清晰可见，就不要再放进菜单。
- **全局导航与局部导航分离**：sidebar/drawer 只负责全局入口与 running sessions；workspace 内的 `Chat / Devtools / Settings` 只放在 workspace bar 或 bottom nav。
- **移动端 footer 独立拥有布局**：bottom nav 必须是独立 footer，负责 safe-area 和自己的 padding；不要把 footer 当成内容区里的一个带 padding 的卡片。
- **文案表达优先语义，不优先控件**：先问“这是一条定位信息、一个状态、一个动作、还是一个异常”，再决定用标题、正文、状态文本、按钮还是 banner。
- **最小视口先验**：默认把 `375x667` 视为必须成立的移动端下限；任何新增 shell / route / panel 都要先回答“主滚动区是谁、固定 chrome 是谁、溢出后如何兜底”。

## 9) 字体与排版最佳实践（WebUI）

- **CJK 优先，不做中文特化**：字体方案按 CJK（zh/ja/ko）统一设计，不针对单一语言做硬编码分支。
- **Google Fonts 统一入口**：在 `index.html` 注入字体；按语言选择 `.com` / `.googleapis.cn`，并配套 `preconnect`。
- **字体 token 单一真源**：只通过 `styles.css` 的 `--font-sans/--font-mono/--font-serif/--font-nav` 管理字体，不在组件内写 `font-family`。
- **语义排版类优先**：优先使用 `typo-title-*`、`typo-emphasis`、`typo-body`、`typo-caption`、`typo-code`，避免分散写临时字号/行高。
- **职责分层固定**：
  - 标题 + 强调块：`serif`
  - 正文 + 控件：`sans`
  - 代码/结构化内容（JSON/YAML/日志/终端片段）：`mono`
- **密度优先原则**：在可读前提下保持紧凑（尤其移动端）；统一通过排版 token 调整，不做局部“魔法数字”。
- **变更验收要求**：字体改动后至少走查 Chat、LoopBus、Settings 三块，确认中英日文/韩文混排无明显抖动或 fallback 断层。
- **技术面板密度优先**：Cycles / LoopBus / Model / Terminal 这类技术面板优先使用 `typo-caption`、`typo-code`、`typo-emphasis` 的紧凑组合；避免 oversized title、重复 chip 和高饱和大面积状态色。

## 10) Icon 使用最佳实践（WebUI）

- **统一来源**：所有可交互/状态型图标统一使用 `lucide-react`，禁止混用 Unicode 符号（如 `×/→/↓`）充当 UI 图标。
- **语义优先**：图标用于表达动作或状态（关闭、方向、运行状态），不用于替代正文信息。
- **背景图标规则**：当图标作为装饰层（例如流程卡片背景箭头）时，必须 `pointer-events-none` 且低对比度，避免干扰主文本。
- **尺寸规范**：默认图标尺寸使用 `h-4 w-4`，紧凑信息区用 `h-3 w-3`；同一区域保持一致。
- **文本并排规范**：纯内联片段才允许直接写 `inline-flex items-center gap-*`；只要元素同时承担“surface + 图标 + 文字”的职责，就必须走统一 affordance 组件，不允许在业务代码里手搓 `gap + px + py`。
- **可访问性**：纯装饰图标不应影响可读内容；交互图标按钮必须有 `aria-label/title`。

## 10.2) Tooltip 使用契约（WebUI）

- **tooltip 只隐藏非关键说明**：tooltip 适合 icon-only action、截断标识、补充解释；核心状态、错误、主导航、主动作不得只放在 tooltip 里。
- **先可见再补充**：用户完成当前任务所必需的信息必须默认可见；tooltip 只补充“为什么/更多说明”，不能替代正文。
- **列表里优先收纳噪音**：session rail、tooling list、icon action 这类高密度列表，优先用 tooltip 收纳长路径、二级解释和额外帮助，避免把主列表撑乱。
- **移动端必须有替代路径**：如果某说明在移动端 hover 不可靠，就必须同时提供 `title`、长按菜单或可见文本兜底。

## 10.1) Icon + Text Surface 契约（WebUI）

- **统一入口**：按钮使用 `ButtonLeadingVisual` / `ButtonLabel` / `ButtonTrailingVisual`；徽标使用 `BadgeLeadingVisual` / `BadgeLabel` / `BadgeTrailingVisual`；其余展示型 surface 使用 `InlineAffordance*`。
- **显式 slot，不做猜测**：图标与文本的布局必须通过 slot 明确声明，不依赖 child 顺序推断业务语义。
- **padding 规则**：图标所在侧的 `padding-inline` 必须收紧到与 `padding-block` 同级，文字侧再保留较大的水平留白；该规则只在 affordance primitive 内实现，不在 feature 代码重复书写。
- **业务代码禁手搓**：feature 层禁止再写 `inline-flex items-center gap-* px-* py-*` 来拼装图标+文字的按钮、badge、摘要条、列表操作项；一律复用统一 primitive。
- **回归测试要求**：新增或改动 icon+text surface 时，至少补一个 unit 或 Storybook DOM contract，断言 `data-inline-affordance-layout` 与关键 spacing class。

## 11) shadcn/ui Skill 入口

- **官方 LLM 入口**：`https://ui.shadcn.com/llms.txt`
- **执行约束**：涉及 WebUI 组件设计/实现时，先以该入口文档作为 shadcn/ui 的首要技能参考源。

## 12) shadcn/ui 组件实现约束

- **优先 Base UI**：在本项目中，shadcn/ui 相关组件封装默认基于 `@base-ui-components/react`，不再新增 Radix 依赖。
- **先封装再使用**：业务代码只使用 `src/components/ui/*`，避免在 feature 页面直接引入底层 primitives。
- **风格统一**：交互状态统一用 data attributes（如 `data-[active]`、`data-[starting-style]`）驱动样式，减少运行时分支判断。

## 13) Chat / Markdown 契约（WebUI）

- **输入保真优先**：输入层只采集，不解释；用户输入什么，`session_block.content` 就落什么。`\n` 只有在用户真的输入反斜杠时才允许出现；renderer 禁止猜测性解码。
- **消息原文单一真源**：`session_block.content` / chat message `content` 始终保存原始 Markdown 文本；preview 只是投影，不得覆盖或篡改原文。
- **频道语义单一所有者**：`channel` 只表达消息语义（`to_user` / `self_talk` / `tool_call` / `tool_result`），UI 可以据此改变色彩与布局，但不得再自动注入 `Self-talk`、`Reply` 之类正文标题。
- **Chat Row 结构先归一化**：先把 `messages + tool pairs + aiStatus` 归一化成统一 `ChatRow` 列表，再渲染 UI；不要在 JSX 分支里临时拼凑循环状态。
- **对齐契约属于行容器**：左右对齐必须由 row wrapper 负责（如 `data-chat-align=start|end`），bubble 只负责视觉皮肤；避免把 `ml-auto/mr-auto` 这类布局副作用塞进配色 helper。
- **Markdown 双视图契约**：`raw` 显示原始 Markdown；`preview` 显示可视化投影。复制 Markdown 时必须回到原始文本，而不是复制 HTML 文本。
- **Code Fence 预览契约**：在 `preview` 中，fenced code 必须隐藏原始围栏语法（如 ``` 与原始 info string），只展示语言语义与代码内容；高亮 token 必须服从当前 surface 的可访问配色。
- **Surface 驱动而非魔法样式**：聊天、检查器、文档等场景统一通过高语义 surface/usage 配置 Markdown 外观，避免在业务组件内散落 `padding/max-height/radius` 魔法值。
- **Tool Fence 升级规则**：只有符合 `yaml+tool_call` / `yaml+tool_result` 契约且 schema 合法的 fenced block，才允许提升为结构化工具视图；否则一律按普通 code block 客观展示。
- **Inspector 分工明确**：`MarkdownDocument` 只用于真正的自由文本字段（system prompt、message text 等）；对象/数组/HTTP body/tool schema 一律走结构化渲染器，避免把结构化数据伪装成文档正文。
- **Inspector 分组优先于长列表**：Model / Devtools 这类面板，优先用 tabs 把 request/result/tools/context/calls 分开，而不是把异构信息堆在同一个长滚动列表里。
- **CodeMirror surface 密度控制**：聊天/检查器这类高频列表里，少量项优先直接内联渲染；达到阈值后再切到虚拟滚动，避免“小列表也上 virtualizer”带来的测量抖动和真实 DOM / jsdom 偏差。
- **Cycle first only in tooling**：Chat 可以暴露 cycle 导航，但正文仍以 conversation 为主；完整 cycle 细节只进入 Devtools，不把技术事实重新堆回主聊天流。
- **Bubble first, tooling second**：Chat 默认只表达 message / attachment / status / time；cycle、model、tooling 入口必须退到 context menu、长按菜单或 Devtools。
- **时间提示要克制**：聊天流里的时间提示遵循 `debounce 2min + throttle 30min + cross-day 强制分隔`；时间是阅读辅助，不是新的信息噪音。
- **附件可用性不等于模型兼容性**：图片粘贴/拖拽/选择能力默认开启；是否能把图片送进当前模型，由发送时校验与 notice 决定，不能靠 UI 先行硬隐藏。

## 13.1) Session / Runtime 状态优先级

- **Session 状态优先于残留 runtime**：当 `session.status` 已经进入 `stopped`/`error`，路由工具栏、notice、侧边 running rail 必须优先反映该 durable 状态，不能被尚未回收的 `runtime.started` 覆盖。
- **停止态需要单一语义**：`Start/Stop` 主按钮、页面 notice、导航入口必须共享同一状态判断，避免出现“侧栏已停止、主面板仍显示运行中”的分裂体验。

## 13.2) Profile Image 契约（WebUI / App Server）

- **语义 URL 固定**：session 图标与 avatar 图标必须各自拥有稳定的语义 URL（如 `/media/sessions/:id/icon`、`/media/avatars/:nickname/icon`），调用方不感知 fallback 或上传态差异。
- **fallback 由服务端兜底**：前端可以把 fallback SVG 光栅化后回传 WebP，但渲染正确性不能依赖前端先上传；服务端必须始终能直接生成 deterministic fallback。
- **上传覆盖，不改接口**：上传 icon 只改变同一语义 URL 背后的资源，不新增“uploaded vs fallback”两套消费路径。
- **Session 与 Avatar 分开建模**：两者可以复用存储 helper，但 API 语义必须保持分离；业务层不得退化成抽象不清的 generic image bucket。
- **全局 avatar 属于用户层**：avatar catalog 和用户级头像设置属于 global settings，不属于 workspace settings；workspace 只消费结果，不维护用户主档。

## 14) AIInput / Workspace Path Search

- **CodeMirror async autocomplete**: 对接远程/异步搜索时，不要给 completion result 设置会吞掉重查的 `validFor`；让每次 token 变化都能重新请求真实候选。
- **`@` 路径补全触发规则**: 只要光标仍在 `@path` token 内且当前补全不在 `active/pending`，就应立即重新 `startCompletion`，不能只在 `@` 或 `/` 时触发一次。
- **Workspace 索引真源**: Git 工作区优先使用 `git ls-files --cached --others --exclude-standard -z` 构建索引，确保 `.gitignore` 在索引阶段就被排除；`rg --files --hidden --no-require-git -0` 只作为非 Git fallback。
- **索引排除优先于结果过滤**: 被 ignore 的文件不要先进内存索引再做展示层过滤；性能和正确性都要求在索引阶段直接排除。
- **Ignored 路径的直接寻址例外**: `.gitignore` 只排除全量模糊索引，不排除基于当前已输入路径做的 on-demand startsWith 补全；像 `@node_`、`@node_modules/re` 这类逐步寻址必须仍然可达。
- **Storybook DOM 依赖预热**: 新引入会在浏览器端动态加载的 UI 子包（尤其 `@base-ui-components/react/*`）时，要同步加入 `vitest.config.ts -> optimizeDeps.include`，避免测试中途触发 Vite re-optimize 导致 DOM 用例 flaky。
