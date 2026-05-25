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
- **DOM Contract**：Studio 交互组件优先使用 **Storybook v10 + Vitest**，以 stories 作为组件状态真源，用真实 DOM 场景覆盖输入、弹层、列表、组合面板。
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
- **回归入口**：Studio 至少维护 `bun run --filter 'agenter-ext-studio' test:dom` 作为高价值 DOM 回归入口。
- **串行执行纪律**：`Vitest browser`、`storybook dev`、`storybook:build` 不能并行运行；需要串行执行，避免浏览器会话与 Vite 端口资源冲突。

## 3.2) Storybook DOM 技能手册（上下文清空后直接照做）

### 3.2.1 目标

- Studio 组件的“真实交互”优先通过 Storybook stories 描述，再由 Vitest 在浏览器里执行。
- stories 是组件交互状态的**单一真源**；不要再额外复制一份复杂测试夹具。
- 这套方案主要解决 `CodeMirror`、弹窗、手风琴、虚拟列表、组合面板这类 jsdom 容易失真的问题。

### 3.2.2 当前仓库约定

- Storybook 配置目录：`packages/studio/.storybook/`
- Storybook 主配置：`packages/studio/.storybook/main.ts`
- Storybook 全局预览：`packages/studio/.storybook/preview.tsx`
- Storybook + Vitest 初始化：`packages/studio/.storybook/vitest.setup.ts`
- Vitest 配置：`packages/studio/vitest.config.ts`
- stories 位置：优先与组件同目录，命名为 `*.stories.tsx`
- Story 驱动的 DOM 测试位置：`packages/studio/test/storybook/*.test.tsx`

### 3.2.3 命令

```bash
bun run --filter 'agenter-ext-studio' storybook
bun run --filter 'agenter-ext-studio' storybook:build
bun run --filter 'agenter-ext-studio' test:unit
bun run --filter 'agenter-ext-studio' test:dom
bun run --filter 'agenter-ext-studio' test
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
- Storybook DOM 测试应被视为 Studio 的**BDD 主战场**，而不是装饰性文档。
- 如果真实 DOM 测试失败，优先修组件真实行为，不要为了通过测试去改弱断言。

## 3.3) Studio 双端 viewport 契约

- **桌面端 + 移动端都是强制验收项**：Studio 走查、Playwright E2E、关键 shell/layout 回归，默认都必须同时覆盖 desktop 和 mobile，不能只看桌面端。
- **移动端默认基线**：统一使用 `iPhone 14` 作为默认移动端环境；本项目当前的强制移动 viewport 基线就是 `390px` 宽。
- **Playwright 默认双 project**：`packages/studio` 的 E2E 默认必须跑 `desktop-chromium` + `mobile-iphone14`；单 project 只允许本地调试，不算最终验收。
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

## 5.1) Spec 治理纪律

- `openspec/changes/*` 只承载 change 进行中的 proposal / design / tasks / delta specs，不承担长期真源职责。
- `SPEC.md` 与 `packages/*/SPEC.md` 只承载长期有效的“平台法则 + 正交设计 + durable contract”，必须保持精简，不记录阶段性任务、临时收口状态或执行流水账。
- 任何会改变长期行为、公共契约、系统边界或架构法则的 change，在 archive 之前必须同步更新对应的 `SPEC.md` 或包级 `SPEC.md`。
- 如果 OpenSpec 已推进但 durable spec 未同步，该 change 不得 archive，也不得宣称“已经完成收口”。
- `openspec/specs/*` 用于 capability 级规格沉淀；当其内容已经成为仓库长期法则时，项目级或包级 `SPEC.md` 仍需补齐最小摘要，不允许只留在 archive/change 里。
- `TASKS.md` 不再是项目真源；活跃任务看 `openspec/changes/*`，长期法则看 `SPEC.md` / `packages/*/SPEC.md`。

## 5.2) Design 治理纪律

- `DESIGN.md` 是仓库级的视觉法则、信息架构法则与设计最佳实践真源。
- `DESIGN.md` 只记录 **原则性的、可复用的、durable 的设计规则**，例如布局法则、导航法则、toolbar/page-content 契约、视觉收口纪律、设计过程纪律。
- 具体业务页面的字段、实体、临时 IA、阶段性草图结论，不应直接写进 `DESIGN.md`；这些内容应进入 `openspec/changes/*`、相关 `spec.md`、Pencil 稿或实现文档。
- 使用 Pencil 讨论设计时，必须同步推进对应的 `openspec/changes/*` 文档更新；不能只改设计稿、不改 OpenSpec。
- 开始多轮 Pencil 设计前，必须优先打开仓库内可持久化的 `.pen` 文件；不要把关键设计状态只放在 `/pencil-new.pen` 之类临时文档里。
- 共享设计壳层一旦稳定，应优先抽成中等粒度组件（如 `sidebar / tabs / toolbar / shared header / drawer`），避免继续整屏复制。
- 优先把设计事实同时落在两个地方：
  - Pencil 稿：表达结构、密度、视觉层级、交互入口
  - OpenSpec：表达页面职责、模式切换、持久化/权限/能力边界、未决问题
- 如果 Pencil 允许，应在设计稿中用轻量注释标出关键交互或约束；如果 Pencil 不适合承载这些说明，必须立即把它们写进当前 change 的 `design.md` 或相关 spec，而不是只留在对话里。
- 任何一轮重要设计收敛，至少要同步更新以下之一：
  - 当前 change 的 `design.md`
  - 当前 change 的 `tasks.md`
  - 当前 change 下相关 capability 的 `spec.md`
- 只有两种情况允许在 `DESIGN.md` 出现业务内容：
  - 作为说明原则的简短例子
  - 该业务约束已经稳定到足以成为长期设计法则
- 任何影响长期设计原则的讨论一旦收敛，必须同步更新 `DESIGN.md`，而不是只停留在对话、截图或设计稿里。
- 当 `AGENTS.md`、`SPEC.md`、`DESIGN.md` 三者出现边界重叠时：
  - `AGENTS.md` 管工程协作与执行纪律
  - `SPEC.md` 管平台能力与系统契约
  - `DESIGN.md` 管视觉结构、信息架构与设计最佳实践

## 6) 用户协作方法论（必须遵守）

- **先证据后结论**：先跑真实流程（CLI/TUI/Studio/Browser），再下判断；不凭主观猜测解释问题。
- **保持客观展示**：AI 输出不做“语义篡改/清洗/特化”；UI 只做结构化呈现。
- **前端联调顺序固定**：先验证后端接口与 durable contract，再验证 store / 界面绑定，最后做真实浏览器走查；不要反过来靠 UI 盲测接口。
- **国际化单一真源**：业务层不硬编码文案；统一通过 i18n 包与配置加载。
- **配置优先于硬编码**：模型、终端入口、提示词路径、策略等一律走 settings/prompt sources。
- **元意识：约束与自由度共存**：任何强系统都同时依赖约束与自由度。约束负责稳定，自由度负责适应与涌现；缺少约束会发散，缺少自由度会僵死。不要把“加强结构”误解为“消灭自由度”。
- **元意识：公理不代替推理**：底层规则应像公理，只定义不可违背的边界，不预先替上层推出具体结论。凡是仍应由情境判断、权衡和解释得到的东西，都不应被下沉成硬定理。
- **元意识：势场优于牵引绳**：好的引导像势场，改变行动的倾向和成本；坏的引导像牵引绳，直接替主体完成选择。文档、经验、默认策略可以塑形，但不应越权代替决策。
- **元意识：显式特权才是合法奇点**：系统允许存在少量特权，但必须被明确命名、明确授权、明确边界。未声明的特殊供应会像奇点一样扭曲整体坐标系，应默认视为异常而不是常态。
- **元意识：保留负空间**：未被硬编码的空间不是缺陷，而是通用智能进行组合、变通、纠偏与学习的容量。收口应发生在不变量上，不应吞掉本应留给智能体的探索空间。
- **元意识：投影不等于本体**：标签、摘要、评分、状态名、视图、画像都只是对事实的投影，不是事实本身。任何投影都必须明确暴露自己的投影身份，不能冒充本体进入推理。
- **元意识：可见效果守恒到作用源**：凡是改变外部世界、改变他人可见结果、改变持久化事实的效果，都必须能追溯到明确的作用源。不能接受“效果出现了，但没有清晰的施力点”。
- **架构做减法，算法做加法**：先保证路径直觉、最小可用，再增强算法与可观测性。
- **循环系统哲学**：LoopBus 持续存在；外部熵增（用户输入、终端变更、任务事件）与未收敛的 attention debt 都可以成为下一轮 AI 调用的合法唤醒源。
- **Containment Law**：`score > 0` 表示义务仍然存在，不等于允许立即再次调用模型；重复等价失败或 no-progress 必须进入 `backoff` 或 `blocked`，直到新证据、定时回退到期或人工干预解除。
- **LoopBus 等待模型**：统一使用 `waitCommitted(fromHash)` 等待各子系统输入；任一输入 resolved 后，固定再等 `loopWaitMs=300ms` 再 collect。
- **Waiter 清理纪律**：`Promise.race` 的 losers 必须 reject/cancel，避免 listener / waiter 泄漏。
- **Cancellation 必须共享信号**：stop/abort 不能只靠 timeout；model call、tool execution、plugin lifecycle 必须共享同一 `AbortSignal` 语义，并把 `stopped/aborted/cancelled` 作为显式事实持久化。
- **Session DB 只存事实**：`session.db` 只落 `session_head/session_cycle/model_call/session_block/loopbus_trace/api_call` 这类事实，不落可推导 snapshot/state-log。
- **多终端聚焦**：默认支持多 focused terminal；每个 focused terminal 都独立注入 terminal input，unfocused 仅保留 dirty 状态。
- **Provider 请求纯度**：provider request body 只保留真实 HTTP/model 参数；`collectedInputs` 之类循环事实必须写入 `session_cycle`。
- **Provider 建模双轴化**：`apiStandard` 只表达传输/协议契约；`vendor/profile/extensions` 只表达厂商兼容与增强，禁止再用 vendor 名称替代协议分发。
- **功能层次化呈现**：主界面聚焦聊天与任务推进；进阶能力放入侧栏/工具面板，不堆叠在主视图。
- **问题定位分层实验**：先隔离运行时（PTY/Terminal），再隔离渲染层（xterm/headless/web），逐层缩小问题面。

### 元意识自检（设计前先过五问）

1. 我现在是在定义边界，还是在替未来的情境推理提前下结论？
2. 我现在加的是势场，还是牵引绳？
3. 这个特殊路径，是被命名和授权的奇点，还是未声明的特殊供应？
4. 这个字段、标签、摘要、状态，到底是本体，还是投影？
5. 这个可见效果，能否追溯到明确的作用源？

### 元意识到代码（客观锚点）

- `packages/app-server/src/session-runtime.ts` 中的 `shouldTreatSharedMessageAsReplyPending(...)`、`chatTurnState`、`chatObligationKind` 这类设计，要用“公理不代替推理”“投影不等于本体”审视：不要把情境判断提前固化成事实字段。
- `packages/app-server/src/session-runtime.ts` 中的 `sendMessageTool(... originAckFallback ...)`、自动 ACK、自动外发消息，要用“可见效果守恒到作用源”审视：没有明确作用源的可见效果，应视为越权。
- `packages/app-server/src/agenter-ai.ts` 中构造 social context、summary、metadata 的路径，要用“投影不等于本体”审视：摘要、组织结构、调度信息不能冒充原始事实进入推理。
- `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` 中的 `terminal_focus`、`terminal_unfocus`、`terminal_idle_ready` 这类设计，要用“势场优于牵引绳”审视：生命周期信号可以影响倾向，但不应伪装成行动指令。
- `packages/app-server/src/workspace-tool-provider.ts` 中的 root / workspace authority，要用“显式特权才是合法奇点”审视：特权可以存在，但必须清晰命名、清晰授权、清晰边界。
- `packages/app-server/src/runtime-skill-contract.ts` 中的 `ctx-skill-system`、skill snapshot、skill reminder 这类设计，要用“显式特权才是合法奇点”“保留负空间”审视：未声明的常驻特供会侵占按需推理空间。
- `packages/message-system/src/message-db.ts` 中的 active-visible / unread materialization 路径，要用“投影不等于本体”审视：transcript row 与冻结 read/unread 数组是历史本体，active unread、runtime readiness、active latest、watch predicate 是投影，不能让 recalled row 重新变成 active work。

## 6.1) Git Worktree / Merge Discipline

- **worktree 是默认隔离单元**：新的专题工作默认使用 `.worktree/<topic>`；仓库内 canonical 脚本为 `./.gemini/scripts/wt-setup.sh`、`./.gemini/scripts/wt-clean.sh`、`./.gemini/scripts/wt-merge-verify.sh`、`./.gemini/scripts/wt-land-ff.sh`。
- **脚本必须基于 Git common root**：无论当前在主 checkout 还是子 worktree，创建/清理 worktree 都必须指向同一个共享 `.worktree/` 根目录，禁止在子 worktree 里再嵌套生成 `.worktree/`。
- **merge-ready 必须绑定命名 target ref**：报告“可以合并”时，必须明确写出验证目标，例如 `origin/main`；不允许对模糊的“当前 main 状态”作结论。
- **dirty main 不是合法 merge target**：`main` 上的未提交代码不属于可验证 ref。若这些改动必须纳入验证，先把它们物化成命名 branch/ref，再对该 ref 运行 merge verification。
- **dirty target 先 snapshot 再验证**：对 dirty `main` 或其他 dirty target，先用 `./.gemini/scripts/wt-snapshot-dirty.sh <snapshot-branch>` 生成命名 ref，再对该 snapshot ref 运行 merge verification。
- **merge 前固定先 rebase**：功能分支在宣称 ready-to-merge 之前，必须先对目标 ref 完成 rebase，再运行一次独立 merge simulation；只做 `git merge` 试探、不做 rebase，不算通过。
- **merge simulation 必须在干净隔离环境中进行**：禁止切回用户正在使用的 `main` worktree 做试合并；统一在 disposable verification worktree 中完成 `--no-commit` merge 检查。
- **verified landing 必须走 ff-only 脚本**：验证通过后，从目标 checkout 运行 `./.gemini/scripts/wt-land-ff.sh <feature-ref>`；它会 snapshot dirty target、执行 `git merge --ff-only`，并且默认只恢复 non-overlapping dirty paths，重叠 dirty paths 必须显式审查，不能自动覆盖 landed 分支状态。
- **cleanup 也是受保护操作**：删除 worktree 或 branch 前必须检查 dirty state 和 merged state；除非显式 `force`，否则 cleanup 脚本必须拒绝破坏性移除。

## 6.2) Pure Frontend Worktree Evidence Flow

- **纯前端任务先建标准 worktree，再碰界面**：页面布局、视觉打磨、响应式、交互走查这类纯前端任务，必须先用 `./.gemini/scripts/wt-setup.sh <topic>` 创建 `.worktree/<topic>`，禁止先在主 checkout 或仓库外 ad-hoc worktree 动手。
- **before 截图先于实现**：开始改 UI 之前，先在该 worktree 内产出 worktree-local `.screenshot/before/*`，作为本轮对比基线；没有 before 证据，不算进入实现阶段。
- **路由级证据优先于 Storybook 替身**：涉及 route/layout/shell 的纯前端任务，before/after 默认必须来自真实 Studio dev server 的真实路由；Storybook 只能补充组件态验证，不能替代 route-level 证据。
- **截图端口必须属于当前 worktree**：拍 route-level screenshot 时，优先使用 fresh inactive port 让脚本从当前 worktree 拉起 dev server；如果端口已被占用，必须先确认进程确实属于当前 worktree，否则直接换新端口，不能盲信任意 localhost 页面。
- **双端截图是默认验收项**：before/after 都必须至少覆盖 desktop 与 `iPhone 14` mobile 两套 viewport；如果任务只修一个端，也要显式展示另一端未回归。
- **证据跟着 worktree 走**：截图统一放在该 worktree 的 `.screenshot/before` 与 `.screenshot/after`，不要散落在主 checkout、临时目录或仓库外路径。
- **实现结束后再拍 after**：代码改动和 targeted verification 完成后，回到同一组路由与 viewport 重拍 `.screenshot/after/*`；只有 before/after 成对存在，才算这个纯前端回合收口。
- **汇报前先核对证据时间戳**：在向用户声明“after 已更新”之前，必须核对将要引用的 route-level 与 close-up/button-level 截图文件时间戳，确认它们来自同一轮重拍；禁止把旧页面级截图和新局部截图混报成同一轮证据。

## 7) Browser 走查标准（agent-browser）

### 7.1 固定流程

1. 先走 **desktop**，再走 **mobile**
2. `agent-browser open <url>`
3. `agent-browser wait --load networkidle`
4. `agent-browser snapshot -i`
5. 交互后重新 `snapshot -i`
6. `get text body` + `screenshot --full` 记录证据

补充约束：

- **双端硬约束**：Studio 浏览器走查必须同时产出 desktop 和 mobile 两份证据。
- **默认移动端设备**：若无特别说明，mobile 一律按 `iPhone 14` 的 viewport/safe-area/touch 环境走查。
- **路径必须真实**：移动端必须走真实 compact 导航路径（如 `Open navigation`、drawer、bottom nav），不能用桌面端捷径替代移动端交互。

### 7.2 默认回归用例（Studio）

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

## 8) Studio 布局最佳实践（Flex）

- **禁止使用 `min-h-0`**：在本项目 Studio 中不再使用该 class 处理滚动/压缩。
- **`overflow-hidden` 不是默认布局工具**：禁止把 raw `overflow-hidden` 当作修复 flex/scroll 的通用手段；先修正布局层级与滚动所有权。
- **移除 hidden 必须补 scroll owner**：一旦去掉祖先 `overflow-hidden`，必须同步为真正的内容区补上显式滚动拥有者；对 surface 级内容统一使用 `ScrollView`，不能只“去掉裁剪”却不恢复滚动。
- **布局壳层禁止 raw clipping**：shell、route wrapper、panel wrapper 这类 layout surface 不允许直接写 raw `overflow-hidden`；应用级视口裁剪必须走 `ViewportMask`。
- **主滚动区显式化**：每个 major panel 只允许一个主滚动区，并且必须通过 `ScrollView` 表达，而不是在祖先和子孙同时混用 raw `overflow-*`。
- **滚动法则升级为原语**：任何用户可见滚动区域都必须通过 `ScrollView` 获得滚动能力；`ScrollView` 同时承担普通滚动与虚拟滚动，feature code 不得再手写 `overflow-auto/scroll` 作为滚动 owner。
- **Flex/Grid 不会自动变成滚动层**：当内容区位于 `flex-1`、`grid` 的 `minmax(0,1fr)` 行列中时，仍然必须显式声明 `ScrollView` 作为滚动 owner；“高度对了”不等于“能够滚动”。
- **视觉裁剪单独建模**：圆角媒体、终端窗口、Markdown/code surface 这类明确的视觉裁剪，统一使用 `ClipSurface`；不要把视觉裁剪和布局约束混在一个容器里。
- **动画裁剪例外最小化**：只有像 `Accordion` 这种 animation primitive 允许保留 raw `overflow-hidden` 作为过渡 mask；新增例外必须先抽象成 primitive，再更新 allowlist。
- **滚动容器单点定义**：每个面板只保留一个主滚动区，避免多层嵌套滚动导致内容挤压与重叠。
- **背景色必须有语义所有者**：`bg-*` 只允许出现在 semantic surface、交互控件、内容可视化块上；shell/layout wrapper 不得直接拥有 raw 背景色。
- **先定 surface，再定 padding**：需要圆角、阴影、背景时，先抽象为 `surfaceToneClassName(...)` 或 surface primitive，再决定内部 padding；禁止在 layout 容器里同时混入 `bg-* + rounded-* + shadow-*`。
- **裁剪与背景默认解耦**：`ClipSurface` 负责裁剪，semantic surface 负责背景；只有媒体/终端这类必须“裁剪即填充”的内容，才允许同一容器兼有二者。
- **谁裁剪，谁解释原因**：只有明确的内容 surface 才能同时拥有 `border-radius + clip + fill`；layout wrapper 只负责排布，不得顺手接管视觉裁剪。
- **移除裁剪必须恢复滚动语义**：如果去掉某层 `overflow-hidden/ViewportMask/ClipSurface`，必须同步确认滚动是否仍有单一 owner；“视觉问题修了但内容不滚动”视为回归。

## 8.1) Apple 风格信息架构（Studio）

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

## 9) 字体与排版最佳实践（Studio）

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

## 10) Icon 使用最佳实践（Studio）

- **统一来源**：所有可交互/状态型图标统一使用 `lucide-react`，禁止混用 Unicode 符号（如 `×/→/↓`）充当 UI 图标。
- **语义优先**：图标用于表达动作或状态（关闭、方向、运行状态），不用于替代正文信息。
- **背景图标规则**：当图标作为装饰层（例如流程卡片背景箭头）时，必须 `pointer-events-none` 且低对比度，避免干扰主文本。
- **尺寸规范**：默认图标尺寸使用 `h-4 w-4`，紧凑信息区用 `h-3 w-3`；同一区域保持一致。
- **文本并排规范**：纯内联片段才允许直接写 `inline-flex items-center gap-*`；只要元素同时承担“surface + 图标 + 文字”的职责，就必须走统一 affordance 组件，不允许在业务代码里手搓 `gap + px + py`。
- **可访问性**：纯装饰图标不应影响可读内容；交互图标按钮必须有 `aria-label/title`。

## 10.2) Tooltip 使用契约（Studio）

- **tooltip 只隐藏非关键说明**：tooltip 适合 icon-only action、截断标识、补充解释；核心状态、错误、主导航、主动作不得只放在 tooltip 里。
- **先可见再补充**：用户完成当前任务所必需的信息必须默认可见；tooltip 只补充“为什么/更多说明”，不能替代正文。
- **列表里优先收纳噪音**：session rail、tooling list、icon action 这类高密度列表，优先用 tooltip 收纳长路径、二级解释和额外帮助，避免把主列表撑乱。
- **移动端必须有替代路径**：如果某说明在移动端 hover 不可靠，就必须同时提供 `title`、长按菜单或可见文本兜底。

## 10.1) Icon + Text Surface 契约（Studio）

- **统一入口**：按钮使用 `ButtonLeadingVisual` / `ButtonLabel` / `ButtonTrailingVisual`；徽标使用 `BadgeLeadingVisual` / `BadgeLabel` / `BadgeTrailingVisual`；其余展示型 surface 使用 `InlineAffordance*`。
- **显式 slot，不做猜测**：图标与文本的布局必须通过 slot 明确声明，不依赖 child 顺序推断业务语义。
- **padding 规则**：图标所在侧的 `padding-inline` 必须收紧到与 `padding-block` 同级，文字侧再保留较大的水平留白；该规则只在 affordance primitive 内实现，不在 feature 代码重复书写。
- **业务代码禁手搓**：feature 层禁止再写 `inline-flex items-center gap-* px-* py-*` 来拼装图标+文字的按钮、badge、摘要条、列表操作项；一律复用统一 primitive。
- **Button 语义优先于去装饰化**：只要控件的语义是 `Button`，尤其是 `variant="outline"` 或 `icon + text` 的 action button，就必须保留可见 border；密度优化只能减弱被动 surface，不能把按钮退化成无边框文字。
- **回归测试要求**：新增或改动 icon+text surface 时，至少补一个 unit 或 Storybook DOM contract，断言 `data-inline-affordance-layout` 与关键 spacing class。

## 10.3) Async / Adaptive / Signal Primitive 契约（Studio）

- **`AsyncSurface` 只负责状态，不负责容器语义**：所有 fetch-driven list/panel 默认复用 `AsyncSurface`；它只表达 `empty-loading / empty-idle / ready-loading / ready-idle`，不得顺手接管滚动、裁剪、背景或 padding 所有权。
- **首屏加载与空态必须分离**：首次加载时显示 loading copy / skeleton；已有数据刷新时保留内容，只显示克制的 refresh signal；禁止把首次加载伪装成空列表，也禁止刷新时清空已有内容。
- **宽度自适应动作统一用 `AdaptiveIconButton`**：会在空间不足时折叠文字的 action，必须通过共享 primitive 实现；折叠前后语义、`aria-label`、`title`、tooltip、点击目标保持一致，业务层不要自己手搓 `ResizeObserver + icon/button`。
- **icon-only 必须换成对称 padding**：文字折叠后，按钮的 inline spacing 必须切换到紧凑、对称、居中的 icon-only 模式；不能保留 label 态的大 padding 造成视觉偏移。
- **被动信息统一用 `SurfaceSignalDisclosure`**：metadata、secondary status、低频说明默认走 signal + secondary surface；它们应挂在 tabs/tool rail 邻近区域，不得为次要信息再占一整行。
- **`Tabs.trailing` 承载次级信号和次级动作**：tabs 右侧的 trailing 区域是被动 signal、metadata disclosure、低优先级 create action 的默认落点；不要再额外插入一层“tabs 之上/之下”的说明条。
- **Session 状态入口只能有一个**：`SessionStatusPillMenu` 使用同一套 compact signal/menu 模型覆盖 desktop + mobile；状态入口放在 route top-edge/header trailing 的局部槽位，不得再复制一个 route-body pill、desktop select 或第二个状态条。
- **primitive 先验收，再组装页面**：只要改到了 `AsyncSurface`、`AdaptiveIconButton`、`SurfaceSignalDisclosure`、`SessionStatusPillMenu` 这类叶子组件，必须先补/改对应 stories 和 DOM contract，再看 composite / route assembly。

## 11) shadcn/ui Skill 入口

- **官方 LLM 入口**：`https://ui.shadcn.com/llms.txt`
- **执行约束**：涉及 Studio 组件设计/实现时，先以该入口文档作为 shadcn/ui 的首要技能参考源。

## 11.1) ai-elements-svelte Skill 入口

- **官方 LLM 入口**：`https://svelte-ai-elements.vercel.app/ai-elements/llms.txt`
- **执行约束**：涉及 `ai-elements-svelte` 组件选择、结构装配、样式纠偏或行为契约时，优先以该入口文档作为官方参考源。

## 12) shadcn/ui 组件实现约束

- **优先 Base UI**：在本项目中，shadcn/ui 相关组件封装默认基于 `@base-ui-components/react`，不再新增 Radix 依赖。
- **先封装再使用**：业务代码只使用 `src/components/ui/*`，避免在 feature 页面直接引入底层 primitives。
- **风格统一**：交互状态统一用 data attributes（如 `data-[active]`、`data-[starting-style]`）驱动样式，减少运行时分支判断。

## 13) Chat / Markdown 契约（Studio）

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

## 13.2) Profile Image 契约（Studio / App Server）

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

## 11) 树状数据结构的开发协同纪律 (Tree Virtualization & Pagination)
- **后端物理边界必须在前端节点级体现**：当请求工作区等存在嵌套的树形结构时，API 的分层机制（如 `deep=1`）和最大返回限制（如 `max=100`），**必须直接反映在前端 UI 的该层节点上**。前端绝对禁止使用“全局加载更多”去掩盖具体子文件夹的内容溢出。
- **搜索即过滤（Search as Filter）**：在处理树状（Workspace）内容的搜索时，必须复用原生的 Tree Component，将其视为一种基于 `gitignore` 语法的**遮罩/过滤器**。匹配的节点被高亮或保留，不匹配的节点被折叠或隐藏。严禁为了搜索而硬编码一套全新的、脱离了树形上下文的平铺（Flat List）页面。
