# Attention-First 重构与验收需求清单

> 这是我对最近几天反复沟通内容的一次统一整理。
> 目的不是做总结，而是把已经明确过的目标、约束、最佳实践、当前阻塞问题和后续验收标准，整理成一份可以持续对照的需求文件，确保后续实现始终走在正确的方向上。

---

## 0. 这份文件的定位

我希望后续所有相关开发，都把这份文件当作当前阶段的工作基线。

它不是随意性的想法记录，而是：

1. 我已经多次明确过的核心架构原则；
2. 我已经多次指出、但实现中仍然反复偏离的问题；
3. 当前最新的验收意见；
4. 接下来继续推进时，必须优先满足的目标。

如果后续实现与这份文件冲突，那么默认认为实现错了，而不是需求变了。

---

## 1. 第一性原理：系统为什么要这样设计

我现在这套系统的核心理念非常简单，不要自己把它做复杂：

- 外部世界输入信息，导致系统熵增；
- attention-system 负责承载这些熵增后的“待处理状态”；
- LoopBus 的作用是持续观察 attention，然后驱动 AI-Model 做熵减；
- AI 的输入本质上是 `attention-context + attention-item/commit`；
- AI 的输出本质上也是 `attention-item/commit`，也就是对 attention-context 的继续演进；
- 只要仍然存在 `score != 0` 的 attention-context，LoopBus 理论上就不该彻底停下。

所以：

- terminal-system 不是核心；
- message-system 不是核心；
- browser-system / os-system / 未来插件系统也不是核心；
- **真正的核心只有 attention-system**。

其它 system 都只是：

1. 把外部变化注入 attention；
2. 或者从 attention 中提取特定结果，再投递回自己的 system。

也就是说，message / terminal 不应该各自发展出一套与 attention 并列的主架构，它们本质只是 attention 的输入输出适配层。

---

## 2. 当前明确的总目标

### 2.1 attention-system 是唯一中心

后续架构、命名、Devtools、内核调度，都必须围绕 attention-system 重新组织。

我不希望继续看到：

- 旧版 LoopBus 名词占据主体；
- trace/cycle/model/tooling 成为主视角；
- attention 只是挂在旁边的一个面板。

正确的关系应该是：

- attention 是主语；
- cycle / model-call / tool-call / message / terminal 都只是 attention 演进过程中的事实记录。

### 2.2 attention 要被理解成一个 mini-git / notebook / commit-log

我之前已经明确给过这个升级思路：

- `attention-context` 类似一个文件 / notebook；
- `attention-item` 或更准确地说 `attention-commit` 类似一次 commit；
- 一个 context 可以持续演进；
- commit 可以分叉、合并、关联查询；
- score 是关联和待办强度，而不是语义化标签。

后续视图设计、查询能力、数据结构设计，都应该从这个角度去理解。

---

## 3. attention 数据模型要求

### 3.1 context / commit 的核心概念

我希望系统围绕下面两个核心概念统一：

#### attention-context

- 一个 context 就是一份持续演进的上下文内容；
- 它有明确 owner，通常归属于某个 avatar；
- 它有 `context-id`；
- 它有当前内容、当前 scoreMap、headCommitId；
- 它是 AI 每一轮工作的语义对象。

#### attention-commit

- 每次对 context 的修改只保留一个统一的 commit 接口；
- 不需要再拆成 `append / patch` 这种让心智复杂化的工具；
- 每个 commit 有 `commit-id`；
- commit 是为了修改 context，不是为了单独存在。

### 3.2 commit 的结构约束

commit 至少要包含：

- `meta`
- `scores`
- `summary`
- `change`

其中 `change` 必须支持这些模式：

- `{ type: "update", value: string }`
- `{ type: "diff", value: string }`
- `{ type: "replace", value: Array<{ match: string; replace: string }> }`
- `{ type: "delete-lines", value: Array<`${number}-${number}` | number> }`
- `{ type: "clean" }`
- `{ type: "merge", value: Array<ContextId> }`

### 3.3 score 的要求

- `scores` 是 `Record<Hash, number>`；
- 这里的 key 必须是真正意义上的 hash，而不是语义化长文本；
- 否则 AI 的使用心智成本会非常高；
- `score = 0` 代表该 hash 在当前 context 下已经被解决；
- 相关查询必须支持通过 hash 做多层级关联查询。

---

## 4. LoopBus / Runtime 的正确职责

### 4.1 LoopBus 的本质

LoopBus 只是 attention 的调度器，不是业务逻辑的中心。

我不希望看到大量业务逻辑塞进 LoopBus。

LoopBus 应该做的是：

1. 观察 attention 是否存在未完成工作；
2. 判断当前是否存在有效 wake cause；
3. 收集输入；
4. 调 AI；
5. 落 attention commit；
6. 根据 commit 的结果继续循环或进入等待/阻塞。

### 4.2 重要调度法则

这条必须继续坚持，不能再退化：

- 只要还有 `score != 0`，系统就不应该把工作误判为完全结束；
- 但也不能无意义空转烧 token；
- 所以需要 containment / blocked / backoff / waiting 这些调度语义；
- 但是“存在 unresolved attention”依然是系统持续工作的根本原因。

### 4.3 stop / abort 的区别

我已经明确要求过：

- `Stop`：停止 LoopBus 和当前 model-call，但保留实例与资源；
- `Abort`：在 Stop 基础上销毁 runtime / 终端 / 相关资源；
- 如果 message-system 将来有在线/离线概念，那么 Abort 应该对应离线。

这个边界不能再混淆。

---

## 5. terminal-system / message-system 的正确位置

### 5.1 它们都只是 attention 的适配层

我再强调一次：

- terminal-system 和 message-system 不该发展成与 attention 并列的主架构；
- 它们只是围绕 attention 的 hooks/api 做关联；
- 唯一相对特殊的是 message-system 会把某些符合条件的 attention commit，转发成可见消息。

### 5.2 terminal 的原则

terminal 负责：

- 将终端变更注入 attention；
- 在 focused 的情况下优先触发 attention；
- 提供 terminal 的读写、快照、聚焦、生命周期控制；
- 为 xterm / web component 提供独立 transport。

但 terminal 本身不是主叙事对象。

### 5.3 message 的原则

message-system 负责：

- multi-channel / multi-chat-instance；
- 将收到的消息注入 attention；
- 将符合特定 meta 条件的 attention commit，投递回 chat-channel；
- Chat 页面只能显示真正属于 Chat 的消息，而不能把所有 attention-reply 全部无差别展示出来。

### 5.4 chat-channel / multi-messages 的要求

Chat 面板不是单一 message list，而应该升级成 multi-messages 的能力验证平台。

明确要求：

- WebUI 当前 message-system 使用的 channel，统一称为 `chat-channel`；
- 1v1 对话使用 `chat-` 前缀；
- 多人房间使用 `room-` 前缀；
- chat-channel 自己要有独立 db；
- chat-channel 是一套可以独立工作的聊天平台，而不是依附在 attention 上的临时 UI；
- Agenter 内核只对接 chat-channel 的核心能力：接收、发送、查询、元数据；
- 复杂体验能力由 `chat-channel + chat-view + plugin` 自己闭环实现。

### 5.5 chat-view 的产品要求

我已经明确要求过两个版本：

- `web-chat-view`
- `flutter-chat-view`

其中：

- `web-chat-view` 要基于当前 React 方案演进，但要按 chat-channel 的独立服务协议来重新设计；
- `flutter-chat-view` 目前先保留设计文档与子包骨架，为未来 flutter-web / native 落地做准备；
- chat-view 需要预留插件化扩展，例如：
  - `@` 路径选择
  - `/` command 命令面板
  - `$` skills 技能面板
  - 截图插件
  - 附件插件

这些能力应该是 chat-channel / chat-view 插件，而不是把业务硬编码到 Chat 页面里。

### 5.6 ChatChannel 的 token / admin 模型

这个点后续必须作为正式设计的一部分，不要继续忽略：

- new ChatChannel 时就需要超级管理员 token；
- 后续对 Channel 元数据的管理，都必须通过 token；
- 添加用户、修改用户名、管理参与者，都需要 token；
- 发送消息也应该使用对应 token 调接口；
- 只有这样，未来独立演进成 ChatApp 时，安全模型才成立。

### 5.7 terminal-view / transport 的要求

terminal-system 也已经有明确方向：

- terminal-system 自己启动 ws transport；
- 形如 `ws://localhost:$PORT/pty/$TERMINAL_ID`；
- `terminal-list` 可以拿到 terminalId；
- `terminal-get-config` 可以拿到 transport port；
- `terminal-view` 需要作为独立 WebComponent / 包来开发；
- 终端渲染要基于正确的 fit 逻辑，而不是错误地让终端尺寸被前端容器硬覆盖；
- 终端要支持完整滚动缓冲区同步，而不是只看一个局部窗口。

---

## 6. Devtools / 信息架构目标

### 6.1 总原则

Devtools 不是信息垃圾桶。

每个面板必须回答一个问题：

- 这个面板存在的意义是什么？
- 它帮我判断 attention 当前处于什么状态？
- 它帮我定位熵增来源、熵减过程、阻塞原因还是收敛结果？

如果一个面板只是堆信息，而没有明确问题导向，那就是设计错了。

### 6.2 attention 面板的目标

attention 面板应该成为 Devtools 的主视角之一。

目前最新要求：

1. `Contexts` 面板改名成 `Attention`；
2. `Items` / `Context` 这两个 tab，不应该在页面最上方；
3. 它们应该在点击某个 attention-context 后，出现在右侧详情面板顶部；
4. `Query commits` 不应该依赖内存态直接锁定，而应该和导航绑定；
5. 也就是说，查询状态、选中状态、详情状态，应该成为可导航、可还原、可分享的 URL 状态，而不是脆弱的前端临时状态。

### 6.3 cycles 面板的目标

我之前已经说明过，cycles 面板不是我想要的样子。

正确理解应该是：

- cycle 只是一次 attention 调度回合；
- 它不是独立于 attention 的主模型；
- 它应该服务于“解释某个 attention-context 是如何演进的”；
- 它不应该喧宾夺主。

后续 cycles 面板需要围绕 attention 重新设计，而不是继续沿用旧版 LoopBus 技术面板思路。

---

## 7. 路由与导航要求

### 7.1 Session 路由

当前我明确要求：

- 不要再用这种长 query 参数风格：
  - `/workspace/devtools?workspacePath=...&sessionId=...`
- 改成语义化路由：
  - `/session/$SESSION_ID/devtools`

后续相关页面都应该往这个方向收敛。

### 7.2 导航状态必须可恢复

像 attention query、context 详情、当前 tab、当前选中的对象，这些都不应该只靠内存状态支撑。

它们至少要满足：

- 刷新后能恢复；
- 可以复制链接给别人；
- 不会因为组件重建而丢状态。

---

## 8. WebUI 交互和工程流程要求

### 8.1 组件化先于页面组装

后续开发流程必须继续严格执行：

1. 先做组件；
2. 先写 Storybook stories；
3. 先做 Storybook DOM 测试；
4. 通过后再组装到页面。

如果页面组装后才发现一堆布局、状态、交互问题，说明开发流程错了。

### 8.2 桌面端 + 移动端双端验收

这已经是项目最佳实践的一部分，后续不能再忘：

- 桌面端要走查；
- 移动端也要走查；
- viewport、紧凑布局、状态展示、导航入口，都要双端可用。

### 8.3 性能最佳实践

我已经多次指出：

- Chat / Devtools / 长列表性能必须认真处理；
- 要考虑几年级别的长对话与长历史；
- 要使用统一的长列表加载接口设计；
- 要做虚拟滚动、逆向分页、状态分层显示；
- 不能再因为 React 用法不当导致 CodeMirror / 复杂组件持续重建。

### 8.4 长列表 / 通用加载协议

这已经不只是优化建议，而是基础要求：

- Chat 列表要支持几年尺度的历史；
- 数据加载要基于时间逆向分页；
- 后端要提供统一的超长列表加载接口设计；
- 这种设计要能复用到：
  - Chat 历史
  - Cycles 列表
  - Terminal Activity
  - LoopBus 面板列表
  - Model 面板终端相关列表

这不应该每个页面各做一套。

### 8.5 共享 UI primitive 的要求

我已经明确要求过，这类模式应该沉淀成统一组件，而不是每个页面手搓：

- `AsyncSurface`：统一表达
  - 有数据加载中
  - 无数据加载中
  - 有数据无加载
  - 无数据无加载
- `AdaptiveIconButton`：空间足够显示文字，不足自动折叠，仅保留图标，并保持正确 padding / tooltip / aria
- `SurfaceSignalDisclosure`：次要元信息和帮助信息不要独占一行，要压缩成 signal / icon / disclosure
- `JSONViewer`：支持
  - `raw-text-json`
  - `fmt-highlight-json`
  - `highlight-yaml`

并且默认优先用 YAML 作为 JSON 的 preview 展示。

---

## 9. 当前已确认但必须持续守住的工程规范

### 9.1 OpenSpec / commit 工作流

必须坚持：

1. 先写/更新 spec，独立 spec commit；
2. 再做代码+测试+tasks 状态更新，同步提交；
3. 最后 archive，独立提交；
4. 如果用户不满意重新修改，就重新从 spec 开始。

### 9.2 BDD / Storybook DOM

后续 WebUI 仍然以这些为主：

- BDD-first
- Storybook stories 作为状态真源
- Storybook DOM tests 作为主要交互回归入口
- 真实 DOM 行为优先，不要靠脆弱 jsdom 猜测

---

## 10. 当前最新明确的阻塞问题

以下是我在最新验收中再次确认的问题，优先级很高：

### 10.1 Attention 面板的结构和命名仍然不对

要求：

- `Contexts` 改名为 `Attention`；
- `Items / Context` tab 放进右侧详情面板顶部；
- `Query commits` 与导航绑定；
- 不要依赖脆弱内存态锁定当前查询与详情。

### 10.2 路由仍然不符合预期

要求：

- 当前 `workspace + query` 风格路由，统一迁移到 `/session/$SESSION_ID/devtools` 语义化路由。

### 10.3 Session 仍然会在 `Scores != 0` 的情况下停下

我已经在下面这个 Session 中复现到：

- `3c6220ae-7fa6-4e3c-92e6-6b7ced35a755`

现象：

- 最终 Cycles 停下来的时候，仍然存在 `Scores != 0` 的项；
- 这违反了 attention-first 的调度原则；
- 说明 runtime 仍然会在 attention 未收敛时误判进入停止/静默状态。

这个问题必须继续追根到底，不要只修表面现象。

### 10.4 attention / message 的输出边界仍然必须持续检查

虽然之前已经修过一轮，但这条要长期写进验收标准：

- Chat 页面只能显示真正发往 Chat 的消息；
- attention 内部过程、self-talk、tool-call/tool-result、attention-reply 不能再无差别地出现在 Chat 主视图；
- 只有被明确投递到 message-system / chat-channel 的内容，才应该显示为 Chat 回复。

### 10.5 Devtools 仍需继续 attention-first 化

当前虽然已经有了一些 attention-first 重构，但还不够。

我仍然要求：

- 大量旧版 LoopBus/trace 思维继续被压缩；
- 名词、视图、面板职责进一步围绕 attention 简化；
- 不要继续保留“只是因为旧版里有，所以新版里也摆着”的结构。

---

## 11. 后续验收标准

我希望后续每一轮开发，都按下面的标准验收：

### 11.1 内核层

- attention-context / attention-commit 的关系清晰；
- score 规则正确；
- 只要仍有 `score != 0`，系统不会错误收工；
- 但 repeated no-progress / repeated equivalent failure 不会无限烧 token；
- stop / abort 语义清晰；
- message / terminal 都只是 attention 适配层。

### 11.2 Devtools 层

- 面板围绕 attention 组织；
- cycles 不再喧宾夺主；
- 详情视图、查询、选中状态可导航；
- 信息架构能真正辅助定位问题，而不是堆垃圾信息。

### 11.3 Chat / Terminal / Message 层

- Chat 只显示真正属于 Chat 的内容；
- attention 内部演进不无差别泄露到 Chat；
- terminal 与 message 的输入输出路径，都能清晰映射到 attention 上。

### 11.4 ChatChannel / ChatView 层

- chat-channel 的 channel 命名、元数据、token 管理模型清晰；
- chat-view 有独立协议意识，而不是直接绑死在当前 WebUI 页面实现里；
- 多频道场景能作为 Agenter 同时处理多个对话的能力验证；
- 插件扩展能力有清晰边界。

### 11.5 WebUI 层

- 组件先验收，再组装页面；
- Storybook / DOM tests 有覆盖；
- 桌面端和移动端都可用；
- 长列表、复杂输入、重型组件不会明显卡顿或持续抖动。

---

## 12. 现阶段的工作重点排序

如果要继续推进，我希望优先级这样排：

1. 先把 attention-first 的内核行为彻底做对；
2. 再把 Devtools 的 attention / cycles / 路由 / 详情导航做对；
3. 再继续打磨 chat / terminal / message 的交互与体验；
4. 同时逐步把这些沉淀成稳定的最佳实践与组件规范。

不要本末倒置。

我真正要的是：

- 架构正确；
- 模型正确；
- 路径直觉；
- 验收可证；
- 后续继续扩展时，不会因为基础法则错误而不断返工。
