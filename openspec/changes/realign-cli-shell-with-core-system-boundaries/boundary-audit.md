# cli-shell 边界审计

这份文档只做一件事：把当前仓库里哪些地方还在违背新边界，逐条摊开。

新边界的大白话版本：

- Shell 真相在 `TerminalSystem`
- Room 真相在 `MessageSystem`
- 提示词真相只有 `AGENTER.mdx`
- 授权真相在 `TerminalSystem`
- cli-shell 只是一个 TUI 产品
- tmux 是 TUI host，不是系统本体
- OpenTUI 是 view library，不是系统本体
- 当前 terminal/room/binding 这些信息，只能算 runtime/session facts，不能变成第二份隐藏提示词

## 1. 已纠偏的长期 spec 冲突

### 1.1 `openspec/specs/cli-shell-app/spec.md`

当前状态：

- 已改写为：cli-shell 是一个 extension TUI app
- 明确规定 Shell 真相在 `TerminalSystem`
- 明确规定 cli-shell 不能恢复 `terminal-2` 产品 chrome，也不能把 tmux 提升成 Shell 真相
- 明确规定 `--avatar` / `--session` / `--create-avatar` / `--clear-avatar` 的边界

这次纠偏解决了什么：

- 不再把产品 UI 组合塞回 `TerminalSystem`
- 不再把 tmux 误写成 Shell truth
- 不再把“测试 Avatar”之类概念混进系统本体

当前判断：

- 这一条已经收口，可以视为已完成的 durable spec 纠偏

### 1.2 `apps/cli-shell/SPEC.md`

当前状态：

- 已改写为：`agenter-app-shell` 是 extension app
- 明确区分 core truth 与 presentation-local truth
- 明确规定 `AGENTER.mdx` 是唯一提示词真源

这次纠偏解决了什么：

- 不再把 tmux 从 host 提升成系统本体
- 不再让 status bar / Chat 单例状态冒充 MessageSystem 或 TerminalSystem truth

当前判断：

- 这一条已经收口，可以视为已完成的 package-level durable spec 纠偏

### 1.2.1 `apps/cli-shell/README.md`

当前状态：

- 入口 README 已纠偏为：
  - tmux 只是 local host shell
  - 当前 shell target 仍来自 TerminalSystem app binding
  - MessageRoom 仍来自 MessageSystem

这次纠偏解决了什么：

- 避免后来者从 README 直接得出“TerminalSystem 已经不参与 cli-shell”的错误结论
- 让入口文档和 durable spec / active change 的新边界保持一致

当前判断：

- 这一条也已经收口，可以视为已完成的入口文档纠偏

### 1.3 `openspec/specs/terminal-screen-projection-law/spec.md`

当前状态：

- 已改写为 generic projection law
- 保留 Protocol 1 / Protocol 2、backend-authored projection、offscreen interaction owner 等通用法则
- 明确禁止把某一个产品自己的 composed terminal 命名提升成平台公理

这次纠偏解决了什么：

- 不再让 cli-shell 的旧 `terminal-2` 世界观污染通用投影法则
- 为未来别的 terminal host / renderer host 留出了干净边界

当前判断：

- 这一条已经收口，可以视为已完成的 durable projection-law 纠偏

### 1.4 `openspec/specs/terminal-view-component/spec.md`

当前状态：

- 已改写为 generic terminal-view component family
- `web-terminal-view` / `shell-terminal-view` 都被定义为 backend terminal truth 的投影器
- 不再把 cli-shell 的旧 `terminal-2` 写成组件家族的前提

这次纠偏解决了什么：

- 不再把 terminal-view 组件家族和 cli-shell 的历史产品拓扑绑死

当前判断：

- 这一条已经收口，可以视为已完成的 durable component-law 纠偏

## 2. 活跃 change 冲突

### 2.1 `openspec/changes/move-cli-shell-to-extension-tmux-host`

保留价值：

- `cli-shell` 挪到 `apps/cli-shell` 这个方向是对的
- core 不 import app implementation 这个方向也是对的

冲突点：

- `design.md` 明确写了 `TerminalSystem is not used`
- 还写了 `TerminalSystem is not a participant in this topology`

问题：

- 这不是“解耦”，这是把 shell 真相从核心系统里拿掉了

处理建议：

- 这个 change 不应该直接 apply
- 包位置迁移的部分可以保留为历史输入
- 架构断言整体被本次 realign change supersede

### 2.2 `openspec/changes/refine-cli-shell-tmux-app-shell`

保留价值：

- Help/Chat/TopLayer/status bar 的交互故事有价值
- 鼠标入口、快捷键帮助、单例 Chat surface 这些都还是值得保留

冲突点：

- `proposal/design/tasks` 在反复强调 `tmux-native app shell`
- `design.md` 里把 tmux session options 写成 “local app truth”

问题：

- 这里把“跨进程 UI 状态承载”误升级成“系统真相”
- 也把 Chat/TopLayer 的状态事实和系统事实混在一起了

处理建议：

- 交互故事保留
- “tmux-native truth” 整体降级为 “tmux-hosted presentation”
- 这个 change 的架构层结论同样被本次 realign change supersede

## 3. 当前代码冲突

### 3.1 `apps/cli-shell/src/bootstrap.ts`

证据：

- 只在 bootstrap 时做了 AvatarRuntime + Room 绑定
- 返回结果里没有 terminal binding
- `CliShellBootstrapProgressPhase` 只有 `authenticating`、`room-ready`

问题：

- 这说明 cli-shell 启动链路里，根本没有把“当前 shell 对应哪个 TerminalSystem terminal”建模出来
- 于是后续 Avatar 只能自己去猜 terminal

处理建议：

- 后续实现时必须把 terminal binding 拉回 bootstrap 主路径
- 不是补一个临时查 terminal list 的 hack

### 3.2 `apps/cli-shell/src/tmux-host.ts`

证据：

- 大量 `@agenter_cli_shell_*` tmux session options
- `buildCliShellStatusLeft/buildCliShellStatusRight`
- Chat pane discovery 直接按 tmux pane/process 去找

问题：

- 这些代码本身不是错，错在它们现在承担了太多“真相职责”
- 它们应该只负责 presentation-local state、layout、host actions

处理建议：

- 大部分 UI/host 代码可保留
- 但必须改成“消费 SDK-bound terminal/room/runtime facts”
- 不能继续让 tmux 承担 shell target truth

### 3.2.1 `apps/cli-shell/src/shell-assistant-seeds.ts`

证据：

- prompt seed 里直接写着：`the visible terminal surface is the tmux session attached to the current MessageRoom`
- 还写着：`Treat any MessageRoom conversation as being about that tmux-hosted shell session by default`

问题：

- 这里不是普通文案问题，而是把错误 ontology 直接写进了 Shell Assistant 种子提示词
- 它会继续诱导 Avatar 把 tmux session 当成 shell truth
- 也会继续把 room->terminal 的绑定解释成 tmux topology，而不是 core app binding

处理建议：

- 必须改写成：
  - room 里的对话默认是关于“当前 app session 绑定的 TerminalSystem terminal”
  - tmux 只是 native host/presentation framework
  - root workspace 仍然只是入口环境，不是默认终端目标

### 3.3 `apps/cli-shell/test/cli-shell.test.ts`

证据：

- 测试名直接写着 “TerminalSystem terminal-2 is not created”
- 还断言 `store.terminals` 为空
- 还用源码扫描断言 active path 里不能出现 `createGlobalTerminal(`、`focusGlobalTerminals(`

问题：

- 这些测试把“不要恢复 terminal-2”错误地扩大成了“不要碰 TerminalSystem”
- 这是这轮架构漂移最直接的测试证据

处理建议：

- 这些测试需要重写
- 正确断言应该是：
  - 不创建 `terminal-2` 这类 cli-shell 特化 terminal role
  - 但必须存在一个当前绑定的 `TerminalSystem terminal`

### 3.4 `apps/cli-shell/test/fake-cli-shell-store.ts`

证据：

- `createGlobalTerminal()` 直接抛错：`TerminalSystem must not be used by active cli-shell`

问题：

- 这个 fake store 把错误架构写成了测试公理

处理建议：

- 必须重写
- 新 fake store 应该支持 generic terminal binding / projection / approval 测试
- 只禁止 `terminal-2` 这种产品特化 core path，不是禁止 `TerminalSystem`

### 3.5 `packages/terminal-system/test/control-plane.test.ts`

证据：

- 仍然存在 `shell-*:terminal-1` / `shell-*:terminal-2` fixture
- 仍然有 `composed terminal-2 runtime` 这类测试命名

问题：

- 这不一定表示当前实现仍然依赖 cli-shell 旧架构
- 但这种命名会继续把“某个历史 cli-shell 拓扑”伪装成“TerminalSystem 的天然模型”

处理建议：

- 如果这些测试保留的是 generic composed-terminal capability，就应该改成中性命名
- 如果 capability 本身就是历史错误路线，也应该在后续实现阶段一起删除

### 3.6 `packages/client-sdk/test/app-runtime.test.ts`

证据：

- 仍然存在 `shell-4:terminal-2`、`shell-1:terminal-2` 这类 fixture

问题：

- 这些 fixture 名称会继续暗示“app-runtime 的理想产品就是 cli-shell terminal-2”
- 这会把 generic binding/runtime store 的语义再次拉歪

处理建议：

- 后续应把这些 fixture 改成 generic binding/projection 命名
- 保留测试能力，不保留 cli-shell 历史命名

### 3.7 `apps/cli-shell/src/tmux-host.ts`

证据：

- 仍然有提示文案：`the old terminal-2 fallback is intentionally disabled`

问题：

- 这句提示文案虽然出发点是“别回退到旧架构”
- 但它仍然在把当前错误路径当作用户可感知的现行概念

处理建议：

- 后续实现时应改成更中性的报错
- 不再把 `terminal-2` 当成现行用户语义

### 3.8 `apps/cli-shell/src/cleanup.ts`

证据：

- 仍然识别 `:terminal-1` / `:terminal-2` residue

问题：

- 这里本身不一定错，因为 cleanup 的确可能要处理历史 residue
- 但如果没有注释边界，未来很容易又把 residue 识别逻辑误读为 active runtime truth

处理建议：

- 可以保留 residue 识别
- 但实现时要把语义明确成 migration cleanup / legacy residue cleanup
- 不能让 active runtime correctness 依赖这些 residue 被先清掉

### 3.9 `apps/cli-shell/test/tmux-host.test.ts`

证据：

- 仍然存在测试名：`terminal-2 fallback is not attempted`

问题：

- 它验证的真实意图其实只是“tmux 缺失时，不要回到旧架构 fallback”
- 但测试名继续把 `terminal-2` 当作现行概念暴露出来

处理建议：

- 后续应把测试语义改成更中性的 host fallback 语言
- 比如“没有 legacy host fallback”或“不会切到废弃的旧 host 路径”

### 3.10 当前最需要优先清理的错误测试公理

下面这些不是一般残留，而是会直接把后续实现推向错误方向的高优先级对象：

1. `apps/cli-shell/test/fake-cli-shell-store.ts`
   - 把 `TerminalSystem must not be used by active cli-shell` 写成测试公理
2. `apps/cli-shell/test/cli-shell.test.ts`
   - 把“不恢复 terminal-2”扩大成“attach bootstrap 不应该创建任何 TerminalSystem terminal”
3. `packages/client-sdk/test/app-runtime.test.ts`
   - 用 `shell-*:terminal-2` fixture 暗示 generic binding 的理想形态
4. `packages/terminal-system/test/control-plane.test.ts`
   - 用 `composed terminal-2 runtime` 命名把旧 cli-shell ontology 嵌进通用 TerminalSystem 语义
5. `apps/cli-shell/test/tmux-host.test.ts`
   - 用 `terminal-2 fallback is not attempted` 继续把旧 host 路径暴露成现行语义
6. `apps/cli-shell/src/shell-assistant-seeds.ts`
   - 把 tmux session 直接写成 Shell Assistant 的 shell truth

处理原则：

- 这四类对象应优先于一般文案清理
- 因为它们会直接影响未来代码和测试的推理方向

当前已确认的具体定位：

- `apps/cli-shell/test/cli-shell.test.ts:37-53`
- `apps/cli-shell/test/fake-cli-shell-store.ts:230-269`
- `apps/cli-shell/test/tmux-host.test.ts:642-655`
- `apps/cli-shell/src/shell-assistant-seeds.ts:50-58`
- `packages/client-sdk/test/app-runtime.test.ts:618-657`
- `packages/terminal-system/test/control-plane.test.ts:700-748`

这样后续恢复实现时，不需要再重新搜一轮，可以直接按这些位置开工。

## 4. 提示词与 runtime facts 冲突

### 4.1 新 change 里之前也残留过模糊表述

现状：

- 之前的文案里有 `prompt-source observation`
- 也出现过 “通过 generic runtime context, prompt-source, or attention mechanisms” 这类写法

问题：

- 这种写法会让人误解成：cli-shell 还可以偷偷多挂一层 prompt source
- 这和“提示词唯一真源是 `AGENTER.mdx`”冲突

处理建议：

- 统一改成：
  - `AGENTER.mdx` 是单一可信 prompt source
  - cli-shell binding 只是 runtime/session facts
  - runtime/session facts 不是第二份隐藏提示词

## 5. 真实症状和根因对照

### 5.1 session 6 / session 7 的“没有独立终端”

根因不是：

- Avatar 太笨
- tmux 鼠标有 bug
- 提示词单独一句话没写好

根因是：

- 核心系统里没有一条干净的“当前 cli-shell session 绑定到哪个 TerminalSystem terminal”的事实链
- Avatar 只能从现有核心 truth 里自己猜
- 一猜就会看到历史 residue，比如 `shell-4:terminal-2`

### 5.2 为什么你会感觉“AI 还是拟合到 root_workspace”

根因不是单纯 prompt 不够强

而是：

- 用户在 room 里说的是 terminal 的事
- 但系统没有把“这个 room 对应哪个 terminal”做成可依赖的核心事实
- 那么模型退回控制面 `root_bash` 就是很自然的补偿行为

## 6. 最终处理策略

### 6.1 保留的东西

- `apps/cli-shell` 作为 extension package 的位置
- tmux 作为 host framework
- OpenTUI 作为 room/top-layer/view library
- 当前 tmux 交互故事里的 Help/Chat/status bar/TopLayer 设计输入

### 6.2 必须推翻的东西

- `terminal-1/terminal-2` 作为 cli-shell 现行产品真相
- tmux 作为 shell 真相
- runtime facts 被写成 prompt-source 的任何表述
- “active cli-shell must not use TerminalSystem” 这种测试公理

### 6.3 后续实现时的硬规则

实现恢复时，必须先满足下面几个前置条件：

1. bootstrap 返回当前 terminal binding
2. Avatar 能看到当前绑定 facts
3. `AGENTER.mdx` 仍是唯一 prompt 真源
4. Room/TopLayer/status bar 只消费核心 facts，不再自己发明真相
5. tmux 只负责 host，不负责 terminal truth

### 6.4 用“假设存在 cli-shell-web”反推最小 SDK 面

这是一个很有用的边界检查方法：

- 假设未来还有一个独立产品 `cli-shell-web`
- 它和 native `cli-shell` 一样，都只是 core systems 的产品化展示层
- 区别只在 host framework：一个是 tmux/OpenTUI，一个是 browser/DOM

如果这个假设成立之后，某个能力还必须写成：

- cli-shell 专属 core 分支
- Web 专属 core 分支
- prompt 里的产品私货
- terminal list / tmux pane 猜测逻辑

那就说明 SDK 面还不够干净。

反过来，当前最小 SDK 面至少应该能支持：

1. app binding
   - app resource key
   - 当前 TerminalSystem terminal id
   - 当前 MessageSystem room id
   - 当前 AvatarRuntime identity
   - 当前 attention context ids
2. terminal surfaces
   - projection/read
   - input/write
   - lifecycle
   - approval subscribe
   - approve/deny
   - 后续 wait/cancel
3. room surfaces
   - snapshot/read
   - send
   - focus
4. runtime/session facts
   - 当前 app binding facts 可见
   - 但不能变成第二 prompt source
5. cleanup surfaces
   - 通过 owner system 清理 bound resources

只要这套最小面成立，那么 native cli-shell 和未来的 browser-hosted sibling 都只是普通 app，不需要把产品知识下沉进 core。

## 7. 剩余遗留污染分级

这部分不是说“还有架构没想清楚”，而是说：仓库里还有一些历史残留，名字和文案会继续误导未来的人。

### 7.1 A 类：保留为历史证据，但不能继续当真源

这些内容可以保留，因为它们本来就是历史 change / legacy code / archive：

- `openspec/changes/archive/**`
- `apps/cli-shell/legacy/terminal2/**`
- `openspec/changes/move-cli-shell-to-extension-tmux-host/legacy-residue-audit.md`

处理原则：

- 可以保留
- 但不能再被引用为当前架构依据
- 如果以后有人继续看它们，应该明确知道：这是历史错误路径或历史探索路径

### 7.2 B 类：名称中性化即可，不一定是架构错误

这些地方未必还在推动错误架构，但名字太像 cli-shell 私货，会继续误导：

- `packages/terminal-system/test/control-plane.test.ts` 里如果还在用 `shell-*:terminal-2` 这类 fixture 命名
- `packages/client-sdk/test/app-runtime.test.ts` 里还在用 `shell-*:terminal-2` fixture
- `apps/cli-shell/src/cleanup.ts` 里对旧 residue 的识别逻辑
- `apps/cli-shell/src/tmux-host.ts` 里的 “old terminal-2 fallback is intentionally disabled” 提示文案

处理原则：

- 如果语义只是“旧 residue / 历史兼容对象”，可以留，但最好改成更中性的名字
- 如果语义已经在暗示当前架构 truth，就必须继续改

### 7.3 C 类：仍需要继续 supersede 或补注记

这些 change 目前都已经有 superseded note 或 boundary note，但正文仍保留大量旧叙事：

- `openspec/changes/move-cli-shell-to-extension-tmux-host/design.md`
- `openspec/changes/refine-cli-shell-tmux-app-shell/design.md`
- `openspec/changes/add-cli-shell-web-host/**`
- `openspec/changes/separate-cli-shell-app-from-terminal-view-components/**`
- `openspec/changes/fix-review-cli-shell-attention-authorization/**`

问题：

- superseded note 解决的是“不要直接 apply”
- 但正文内部仍然保留大量旧世界观，未来检索时仍会误导
- `add-cli-shell-web-host` 更危险，因为它除了旧世界观，还把 tasks 打成了已完成
- `separate-cli-shell-app-from-terminal-view-components` 更危险，因为它现在仍然显示为 `in-progress`，而且正文规模很大，极易被误认为“当前主线”
- `fix-review-cli-shell-attention-authorization` 的动作生命周期方向本身是对的，但它对 cli-shell terminal identity 的叙述仍带着旧世界观残影

处理原则：

- 不能直接 apply
- 当前注记已经足以阻止直接 apply，但还不足以防止未来检索误读
- 后续要么做更彻底的文档降噪，要么新开一个 web 侧 boundary realign change，把 web host 重新设计

### 7.3.1 `add-cli-shell-web-host` 当前判断

当前判断很明确：

- 它不是“小问题”
- 它的 proposal / design / tasks 是完整建立在 `terminal-1/terminal-2` 世界观上的
- 而且 tasks 被打成了已完成，这会制造“这条旧路线已经被验证”的错觉

因此它目前属于高风险误导源。

处理建议：

- 不能直接 apply
- 不能只做轻量 wording tweak
- 需要被明确 supersede，或者在新的 web 边界 change 下整体重写
- proposal / design / tasks / delta specs 现在都已经补上 superseded note，因此后续检索时更不容易把它误当现行真源

补充判断：

- 现在还不急着马上新开 web change
- 因为当前更底层的 app binding / terminal identity / runtime fact carrier 还没实现收口
- 在这些 core-facing SDK surfaces 没稳定前，先写新的 web host implementation plan 很容易再次把 host 需求误下沉到 core

因此更合理的顺序是：

1. 先把 native cli-shell 的 core-boundary truth 写清楚并落实到 SDK 面
2. 再用“browser-hosted sibling”思维实验检查 SDK 是否足够
3. 只有当 SDK 面已经稳定时，才单独新开 web host boundary change

### 7.3.2 `separate-cli-shell-app-from-terminal-view-components` 当前判断

当前判断也很明确：

- 它积累了很多高质量的历史分析、验收证据和视觉参考
- 但它的系统 ontology 仍然是 `terminal-1/terminal-2`
- 而且它现在还是 `in-progress`

因此它不是“可以直接继续做的主线”，而是“只能拆出有价值输入，再按新边界重做”的高风险 change。

处理建议：

- 保留其中的历史证据、视觉参考、失败复盘
- 但不得再把它当成当前实现路线
- 后续如果要复用其中内容，必须先翻译到 `realign-cli-shell-with-core-system-boundaries` 的边界语言
- proposal / design / tasks / delta specs 现在都已经补上 superseded note，因此 direct spec-file entry 也不再绕过边界警告

### 7.3.3 `fix-review-cli-shell-attention-authorization` 当前判断

当前判断是：

- 它关于“授权动作必须有 wait/cancel/action lifecycle，而且一切可见变化都应追溯到 attention-item commit”的方向是对的
- 但它对 cli-shell terminal identity 的局部叙述还需要持续纠偏

因此它不能直接当作“cli-shell terminal 绑定模型”的真源，但可以继续作为“TerminalSystem 授权动作物理模型”的输入。

处理建议：

- 保留它的 terminal action lifecycle / attention-item 因果链方向
- 禁止从它里面继承任何旧的 cli-shell terminal ontology
- 后续实现时，应让它依附于 `realign-cli-shell-with-core-system-boundaries` 所定义的 app binding truth

### 7.3.4 `complete-cli-shell-avatar-session-reset` 当前判断

当前判断：

- 这条 change 里关于 `--avatar` / `--create-avatar` / `--clear-avatar` 的产品语义仍然有价值
- 但它仍然建立在“current opened terminal”与旧 `terminal-1/terminal-2` 拓扑叙事之上
- 它还把很多 task 打成了已完成，会制造“旧 terminal identity 模型已经被验证”的错觉

问题：

- 它会继续让后来者以为：
  - cli-shell 当前可依赖的终端模型是“current opened terminal + internal terminal roles”
  - `--web` host 仍然是当前主线的一部分
  - `packages/cli-shell` 仍然是当前产品包路径

处理建议：

- 保留它对 Avatar create/clear 语义的结论
- 但其中关于 terminal identity、web host、包路径的正文都应视为旧边界输入，而不是现行真源
- 后续要么补 boundary note / superseded note，要么直接按当前边界重写正文

### 7.3.5 durable `app-command-launcher` 当前判断

当前判断：

- 这份 durable spec 的平台法则方向是对的：launcher 只做 descriptor lookup，不把产品语义耦合进 core
- 但它仍然把本地开发包路径写成 `packages/cli-shell/package.json`

问题：

- 这不是小文案，因为它属于 durable spec
- 如果不改，会让后来者误以为 `cli-shell` 还在 core packages，而不是 `apps/cli-shell`

处理建议：

- 应直接把 durable spec 改成当前真实路径/真实 package 位置
- 这类路径事实不应继续依赖历史 change 或人工脑补修正

### 7.4 当前最危险的剩余点

从误导性来看，目前最危险的不是 legacy 代码，而是下面这些：

1. 活跃 change 中仍有完整旧叙事  
2. 测试 fixture 命名仍像“cli-shell 官方真相”  
3. `add-cli-shell-web-host` 还在延续 `terminal-2` 世界观
4. `complete-cli-shell-avatar-session-reset` 还在保留旧 terminal identity / `--web` / 包路径叙事
5. `app-command-launcher` durable spec 仍保留 `packages/cli-shell` 本地路径事实

补充一个当前判断：

- 这轮审计之后，污染已经明显收敛，不再是“整个仓库到处都是错边界”
- 现在主要只剩三类：
  1. 旧 change 正文仍保留大段历史 ontology
  2. 测试公理和 fixture 命名继续把旧 ontology 写成“自然事实”
  3. 少量实现报错文案/cleanup residue 语义还没降噪

这意味着后续恢复实现时，优先级也应收敛到这三类，而不是再重新大面积怀疑所有 durable specs

### 7.5 下一步建议顺序

如果继续 spec-only 推进，建议顺序是：

1. 清理测试 fixture 命名，避免 `shell-*:terminal-2` 继续冒充 cli-shell 真相
2. 收口 `tmux-host.ts` / `cleanup.ts` 里的历史提示文案和 residue 语义
3. 收口 `shell-assistant-seeds.ts`，把 tmux session truth 从真实入口提示词中移除
4. 评估 `complete-cli-shell-avatar-session-reset`、`separate-cli-shell-app-from-terminal-view-components` 与 `fix-review-cli-shell-attention-authorization` 中哪些历史输入值得迁移到新边界下
5. 修正 durable `app-command-launcher` 中仍保留的 `packages/cli-shell` 路径事实
6. 评估是否单独新开一个 web host boundary realign change，而不是继续复用 `add-cli-shell-web-host`
