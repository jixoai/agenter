# Agenter 落地验收任务清单

> 这份文档不是替代 `SPEC.md` 和 `openspec/specs/*` 的规范文档，而是把最近几轮的产品任务、架构任务、收口任务、长期标准重新整理成一个可执行的落地与验收清单。
>
> 我的目标不是“记录做过什么”，而是确保：后面不管是谁接手，都能知道哪些是旧任务、哪些是当前 change、哪些已经上升为长期标准、哪些问题在用户走查关闭之前绝对不能算完成。

## 0. 口径

- `已归档基线`：已经进入主规格，后续不再单独立项，默认作为长期回归约束持续生效。
- `当前 change`：已经拆成 OpenSpec change，但还没有 archive；即使 tasks 全 done，也只能算“实现已推进”，不能算“验收关闭”。
- `未关闭问题`：用户已经明确走查出问题，在重新验证关闭之前，不能因为代码提交了或 tasks 勾选了就当成完成。
- `长期标准`：这些不是一次性任务，而是从多轮问题里抽象出来的项目级最佳实践；以后新功能和重构都必须遵守。

一句话：**以后看状态，必须同时看 spec、实现、测试、走查、archive，缺一项都不算真正完成。**

## 1. 产品主线

### 1.1 Chat 主线

我要把 Chat 做成真正面向用户的主界面，而不是技术事实的堆放场。

必须成立的产品要求：
- Chat 以对话气泡为中心，默认只表达用户消息、面向用户的 assistant reply、附件、头像、时间提示、输入框。
- Cycle、attention、tooling、kernel 这类技术事实不能直接占据主聊天流，只能通过 context menu / 长按 / expert affordance / Devtools 进入。
- Chat 的时间提示必须克制：`debounce 2min`、`throttle 30min`、跨天强制分隔。
- 图片输入能力默认可用；模型是否兼容由发送时校验，不由 UI 先硬隐藏。
- optimistic / persisted message dedupe 必须以 identity 为主，不再靠时间戳猜测。
- Chat 不能泄漏内部 attention activity，尤其不能把 internal attention reply 直接打印给用户。

对应的规格 / change：
- 已归档基线：`chat-surface-presentation`、`chatapp-surface`、`multimodal-ai-input`
- 当前 change：`stabilize-chat-devtools-performance-and-inspector-previews`
- 当前收口 change：`refine-attention-user-visible-contract`

当前必须关闭的问题：
- 发一条消息，前端只能显示一条，不能偶发重复。
- Chat 面板不能持续“自言自语”或不停追加 internal attention 相关回复。
- Chat 主视图不能再被 cycle 术语、tool traces、attention records 主导。
- 长历史聊天下，CodeMirror 等重型只读 surface 不能持续重建。
- Chat 必须在桌面端和移动端都能稳定滚动，且只有一个明确的主滚动区。

### 1.2 Devtools / Cycles 主线

我要把 Devtools 做成独立的技术检查面板，而不是 Chat 的附属垃圾场。

必须成立的产品要求：
- Devtools 是 Chat 之外的技术 inspection surface。
- Cycle inspection 要以 timeline / technical panel 的方式呈现，而不是混进聊天流。
- tool-call 和 tool-result 必须合并成一个工具 trace card，而不是拆成两张卡片。
- tool trace 的 loading / done / failed 状态必须正确，不能一直转圈。
- stop / pause / abort 之后，persisted cycle history 仍然应可见，不能直接空掉。
- Devtools 每个 panel 都必须有自己的 scroll owner，不能依赖外层 route wrapper 勉强滚动。
- Facts / structured records 的展示要优先可读性，YAML 作为 preview，JSON 保留为原始视图。

对应的规格 / change：
- 已归档基线：`workspace-devtools-surface`、`cycles-devtools-timeline`、`assistant-history-facts`
- 当前 change：`stabilize-chat-devtools-performance-and-inspector-previews`
- 当前收口 change：`stabilize-cycle-history-and-tool-traces`

当前必须关闭的问题：
- Cycles 详情页必须能正确滚动。
- stop / pause / abort 后，Devtools 仍能看到 persisted cycle 数据。
- tool-call / tool-result 已合并成单卡片，并且状态正确。
- Facts 面板大量 attention items 时，默认 YAML preview 可读，而不是原始 Markdown dump。
- Devtools 的加载状态必须有四态，而不是只有“空”和“有”。

### 1.3 Session 生命周期主线

我要把 session lifecycle 的语义彻底拆清楚，不再把 stop / abort 混为一谈。

必须成立的产品要求：
- `Stop`：只停止 LoopBus，取消当前 model-call，保留 runtime inspection 能力，不销毁 terminal / persisted cycle / devtools 上下文。
- `Abort`：包含 `Stop`，同时销毁 runtime、terminal、以及所有 session-scoped 资源。
- passive inspection 行为不能隐式 start session。
- stop 时，model-call 必须真的被 cancel，而不是只改一个状态文案。

对应的 change：
- 当前收口 change：`split-session-stop-abort-lifecycle`
- 联动复核：`stabilize-cycle-history-and-tool-traces`、`integrate-message-terminal-attention-sources`

当前必须关闭的问题：
- stop 之后切到 Devtools，不会偷偷重新 start。
- stop 之后仍能看历史 cycles / terminal inspection。
- abort 之后 runtime / terminal 确实销毁。
- in-flight model-call 在 stop 时被 signal/abort 正确取消。

### 1.4 LoopBus / Attention 主线

我要把 LoopBus 收敛成真正 attention-first 的 runtime core，而不是 source-specific orchestration glue。

必须成立的产品要求：
- LoopBus 只负责 attention-first runtime orchestration：plugin pipeline、ordered hooks、cycle gating、runtime publication。
- message-system / terminal-system / 未来 browser-system、os-system 等，都是 source adapter，不应和 LoopBus core 混写。
- source 的 invalidation 先进入 attention，再由 LoopBus 判断是否触发 cycle。
- internal attention activity 不自动等于 user-visible reply。

对应的 change：
- 已推进但未 archive：`refactor-loopbus-attention-runtime`、`integrate-message-terminal-attention-sources`
- 当前收口 change：`refine-attention-user-visible-contract`

当前必须关闭的问题：
- source activity 不会绕过 attention pipeline 直接触发 cycle。
- 没有 committed attention delta，就不会因为 source 活动单独起 cycle。
- attention internal updates 不再直接出现在 Chat。
- LoopBus frontend/backend publication contract 保持一致，Devtools 可以正确观察。

### 1.5 Terminal 主线

我要把 terminal 做成一条完整主线：控制面、传输面、渲染面、inspection 面要分层明确，不再互相污染。

分层要求：
- `terminal-system` 是 control plane，统一提供 `terminal_list`、`terminal_create`、`terminal_kill`、`terminal_focus`、`terminal_read`、`terminal_snapshot`、`terminal_write`、config / process profile / shortcut / transport config。
- websocket PTY transport 是 renderer 的标准数据输入边界。
- `focusedTerminalIds` 是一等公民，不再假设只有一个 focused terminal。
- `terminal-view` 必须是独立 WebComponent，而不是 WebUI 私有胶水。
- renderer 自己拥有 scroll / overflow 语义。
- fit / cover 是 terminal 展示模式，不是随便拉伸尺寸的替代方案。
- 终端尺寸策略仍然要遵从“基于前端容器自动 fit”的正确语义，不能回退成错误实现。
- 要保留 ANSI 颜色、合适的终端字体、合理行高、ligature 支持。
- terminal 页面不能只有 renderer，还要基于 `terminalId` 聚合 terminal-read、terminal-write、attention related records、tool call / result、相关 model / api facts。
- renderer 与 inspector 要有各自独立 scroll owner。

对应的 change：
- 已推进但未 archive：`modernize-terminal-control-plane`、`extract-terminal-view-webcomponent`、`propagate-terminal-contract-to-clients`
- 当前持续迭代的收口 change：`restore-terminal-renderer-and-activity-panel`

当前必须关闭的问题：
- terminal 颜色、字体、行高、ligature 都恢复到可用质量。
- terminal 不再抖动、不 backward reset。
- terminal 能滚动整个终端缓冲区，不是只滚一个裁剪后的局部。
- fit / cover 行为与旧版正确语义一致。
- terminal frame 与 terminal screen 的几何关系正确，没有尺寸错配。
- terminal activity panel 真正按 `terminalId` 收拢相关事实。

### 1.6 Identity / Avatar / Global Settings 主线

我要把 session icon、avatar icon、global settings 做成稳定的用户级能力，而不是散落在 workspace 内部的附属实现。

必须成立的产品要求：
- session icon 与 avatar icon 各自有稳定语义 URL。
- fallback 必须由服务端直接提供，且 deterministic。
- 上传只是覆盖 fallback，不改变消费接口。
- Global Settings 负责 user-level settings 与 avatar catalog。
- Workspace Settings 保持 workspace-scoped，不与 global settings 混淆。
- Global Settings 的入口属于 app-level navigation，不属于页面 top header。

对应的规格：
- 已归档基线：`profile-image-system`、`identity-media-assets`、`global-user-settings`、`workspace-settings`、`webui-chat-navigation`

当前必须持续回归的问题：
- 未进入 workspace shell 时，也能管理 global settings 与 avatar catalog。
- session/avatar icon fallback 一直稳定，不依赖前端先上传。
- 全局入口仍在左侧导航或对应 app-level navigation 中。
- workspace settings 与 global settings 边界清晰，不串层。

## 2. 这些已经上升为项目标准 / 最佳实践

### 2.1 WebUI 布局与滚动标准
对应规格：`openspec/specs/overflow-layout-contract/spec.md`

- 每个 major panel 只能有一个明确的 primary scroll owner。
- shell / route wrapper / async wrapper 不能抢滚动，也不能用 raw `overflow-hidden` 当万能修复。
- layout containment、scroll、clip、background owner、animation mask 必须分层建模。
- 移除裁剪时，必须同步恢复真正的 scroll viewport。
- Chat、Devtools、Settings、Terminal 要按各自 route type 声明 scroll model，而不是强行共用一套页面滚动方案。
- 横屏 / 竖屏会影响导航结构与 panel 布局，但不应改变滚动 ownership 原则。

### 2.2 WebUI 性能标准
对应规格：`openspec/specs/runtime-ui-publication/spec.md`、`openspec/specs/webui-render-performance-guard/spec.md`

- route 级别不能订阅过宽 runtime slice。
- inactive tab 不允许继续订阅重数据。
- unchanged selector result 不应重新发布 React-facing value。
- heavy read-only surface，尤其 CodeMirror，不允许因为 identity churn 持续 remount。
- row projection / view model 必须优先做 identity stabilization。
- shell chrome 不能有无意义 callback / array churn。
- 性能回归要通过真实行为测试与 profiling-backed hotspot 覆盖，而不是只靠体感。

### 2.3 Chat / Markdown / Structured Preview 标准
对应规格：`openspec/specs/chat-surface-presentation/spec.md`、`openspec/specs/assistant-history-facts/spec.md`，以及当前 change `stabilize-chat-devtools-performance-and-inspector-previews`

- Chat 只显示用户可见 narrative，不显示 internal attention narrative。
- Markdown 原文是单一真源，preview 只是投影。
- 结构化内容优先用结构化 viewer，而不是把 JSON / object 假装成 Markdown 文档。
- YAML 是结构化 preview 的默认首选；JSON 仍需保留。
- `JSONViewer` 必须轻量，不引入新的 markdown renderer 路线。
- viewer 模式切换要隐藏在菜单中，且支持 local/global 两层控制。

### 2.4 信息架构与导航标准
对应规格：`openspec/specs/webui-chat-navigation/spec.md`、`openspec/specs/global-user-settings/spec.md`

- Global Settings 属于 app-level navigation。
- TopHeader 只属于当前页面，不承载 global capability。
- Chat / Devtools / Settings 是 workspace-scoped route。
- 进阶能力进入 Devtools、context menu、tooltips，不堆在主聊天流里。
- 移动端与桌面端可以有不同导航结构，但能力必须双端可达。

### 2.5 Session / Runtime / Provider 标准
对应规格：`openspec/specs/model-provider-standards/spec.md`、`openspec/specs/model-call-lifecycle/spec.md`、`openspec/specs/runtime-transport-state/spec.md`

- Stop 与 Abort 必须语义分离。
- session durable state 优先于残留 runtime noise。
- LoopBus 持续空转，只在有效输入到来时触发 AI 调用。
- provider routing 要按 `apiStandard`，不是按 vendor 名字猜。
- capability 要显式建模，不能靠 provider 名称隐式推导。

### 2.6 Terminal 标准
对应 change / spec：`modernize-terminal-control-plane`、`extract-terminal-view-webcomponent`、`propagate-terminal-contract-to-clients`、`restore-terminal-renderer-and-activity-panel`

- terminal-system 是 canonical control plane。
- renderer 是独立 `terminal-view`，不是 WebUI 内部细节。
- transport contract、focusedTerminalIds、read representation metadata 必须端到端一致。
- terminal renderer 质量标准包括：颜色、滚动、尺寸、fit/cover、字体、ligature、稳定性。
- terminal inspection 默认按 `terminalId` 聚合，而不是只给一个孤立终端视图。

### 2.7 测试与验收标准
对应文档：`AGENTS.md`、`TESTING.md`

- 行为优先，BDD-first。
- WebUI 复杂交互优先走 `Storybook v10 + Vitest` 真实 DOM。
- 跨层链路用 focused regression，不靠单层 unit test 侥幸通过。
- desktop + mobile 都是强制验收项。
- 不能只看“自动测试过了”，还要看测试是否覆盖了用户明确反馈的问题。

## 3. 当前验收矩阵

### 3.1 已归档基线：后续默认做回归，不再单独立项
- `2026-03-20-chat-ux-icons-and-layout-contracts`
- 这一批已经把下面这些内容沉淀进主规格：
  - Chat conversation-first presentation
  - attachment-first multimodal input
  - profile-image-system
  - global-user-settings
  - workspace-settings separation
  - webui-chat-navigation
  - overflow-layout-contract

### 3.2 已有 change、实现推进过、但不能因为 tasks done 就算完成
- `refactor-loopbus-attention-runtime`：tasks 已完成，未 archive；验收点是 LoopBus core 仍然保持 attention-first，不被 source adapter 反向污染。
- `integrate-message-terminal-attention-sources`：tasks 已完成，未 archive；验收点是 source invalidation 先进入 attention，再决定是否起 cycle。
- `modernize-terminal-control-plane`：tasks 已完成，未 archive；验收点是 terminal-system 真正成为 terminal authority，而不是 app-server runtime glue 的影子包装。
- `extract-terminal-view-webcomponent`：tasks 已完成，未 archive；验收点是 `terminal-view` 真正成为独立 renderer 组件，WebUI 只是 consumer。
- `propagate-terminal-contract-to-clients`：tasks 已完成，未 archive；验收点是 runtime / client-sdk / webui 对 terminal contract 的理解一致，不再存在旧兼容假设主导新实现。
- `restore-terminal-renderer-and-activity-panel`：tasks 已完成，未 archive，但用户明确走查出大量未关闭问题；当前口径只能算“实现做过一轮”，绝不能算“终端主线已完成”。
- `stabilize-chat-devtools-performance-and-inspector-previews`：tasks 已完成，未 archive；自动化覆盖已补齐，但仍需继续以产品体验为准做最终关闭，不允许只凭测试通过就宣称性能问题彻底解决。

### 3.3 已立项、但本质上是下一轮必须推进的收口任务
- `refine-attention-user-visible-contract`：这是 Chat 用户可见契约的收口任务；不关闭它，Chat 就随时可能继续泄漏 internal attention output、继续重复消息、继续在用户面前暴露错误 narrative。
- `split-session-stop-abort-lifecycle`：这是 session lifecycle 语义的收口任务；不关闭它，stop / abort / passive inspection 的边界就一直会继续互相污染。
- `stabilize-cycle-history-and-tool-traces`：这是 Devtools / Cycles inspection 正确性的收口任务；不关闭它，persisted cycle history、tool trace merge、detail scroll ownership 就都不算稳定。

## 4. 统一验收方法

### 4.1 自动化验收
- `vitest + jsdom`：纯逻辑、状态映射、runtime reducers、contract tests。
- `storybook v10 + vitest`：真实 DOM 组件行为，作为 WebUI 复杂交互主战场。
- `playwright / browser walkthrough`：桌面端 + 移动端关键路径回归。
- terminal / lifecycle / runtime / loopbus 要补 focused regression，不允许只靠 UI 体感。

### 4.2 手工走查验收
每次相关任务推进后，至少走查：
- Chat：发送消息、重复消息、internal attention 泄漏、滚动、时间提示、context menu。
- Devtools：cycles timeline、detail scroll、tool trace merge、persisted history。
- Session lifecycle：stop、resume、abort、passive inspection、model-call cancel。
- Terminal：颜色、滚动、buffer、fit/cover、字体、ligature、activity panel。
- Settings / Navigation：global settings 入口、workspace/global 边界、移动端导航。

### 4.3 一个 change 什么时候才允许 archive
只有同时满足下面条件，才允许 archive：
- spec / design / tasks 完整。
- 实现已经落地。
- 自动化测试覆盖到关键行为。
- 用户走查明确关闭问题。
- tasks 与实际关闭的问题一一对应。

## 5. 当前建议的推进顺序

1. `split-session-stop-abort-lifecycle`
2. `refine-attention-user-visible-contract`
3. `stabilize-cycle-history-and-tool-traces`
4. `restore-terminal-renderer-and-activity-panel` 二轮收口
5. 对已 done 但未 archive 的 change 做综合走查与归档判断

## 6. 最后的执行原则

- 旧任务没有消失，只是其中一部分已经升级成长期标准。
- 当前 active changes 不是互不相关的小任务，而是 4 条主线：Chat / Devtools、Session lifecycle、LoopBus / attention、Terminal。
- 以后只要用户继续补充问题，先判断是补到已有 change 的收口任务里，还是确实需要新开 change；不要默认再平铺一个新任务。
- 最终目标不是“把 change 列满”，而是让每条产品主线都能被正确实现、正确测试、正确走查、正确 archive。
