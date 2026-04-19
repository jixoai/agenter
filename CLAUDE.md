# Claude Runtime Playbook

本文件是 Claude Code 在本仓库的**运行挂载点**，不承担 durable law 真源职责。
它只承载 Claude 特有的能力层（skills / subagents / plan mode / memory / MCP / hooks），并通过引用继承 codex / gemini 已沉淀的工程与设计纪律。

---

## 0) 文档边界与引用拓扑

Claude 进入仓库时必须先认清四个真源，绝不在本文件里复述它们：

| 真源               | 角色                                          | 锚点                                            |
| ------------------ | --------------------------------------------- | ----------------------------------------------- |
| `AGENTS.md`        | 工程协作与执行纪律（BDD / worktree / 走查）   | §3 §5 §6 §7 §8 §10 §11 §13                     |
| `DESIGN.md`        | 视觉与信息架构法则                            | §2 §4 §5 §7 §8 §11 §12                         |
| `SPEC.md`          | 平台法则、正交边界、durable runtime contract | §2 §3 §4 §5                                    |
| `packages/*/SPEC.md` | 包级长期契约                                | 按包阅读                                        |
| `openspec/changes/*` | 进行中的 change proposal / design / tasks   | 新增契约在这里发起                             |
| `.gemini/GEMINI.md` | Gemini runtime 的轻量挂载点（UI review）    | `ui-capture.sh` 入口                           |

**共享基础设施真源**：`./.gemini/scripts/`（`wt-setup.sh` / `wt-clean.sh` / `wt-merge-verify.sh` / `wt-snapshot-dirty.sh` / `wt-land-ff.sh` / `ui-capture.sh`）。

> **禁止事项**：不新建 `.claude/scripts/` 或 `CLAUDE-AGENTS.md` / `CLAUDE-DESIGN.md` 之类的副本；不将 AGENTS/DESIGN/SPEC 条款粘贴到本文件；不在本文件里发起会改变 durable law 的决议。

---

## 1) 继承契约（Claude ⊇ codex/gemini）

Claude 在本仓库的一切输出默认遵守以下继承链：

1. **工程纪律** ← `AGENTS.md` 全文（BDD、测试分层、Storybook DOM、双端 viewport、worktree、browser 走查、WebUI 布局/字体/图标/Async primitive、Chat/Markdown、AIInput、树状结构）
2. **设计纪律** ← `DESIGN.md` 全文（三层布局、Chrome Window、Page Content、Toolbar、视觉收口、过程纪律、PreviewPort）
3. **平台法则** ← `SPEC.md` 全文（attention 内核、LoopBus、Session/Room/Terminal/Workspace truth、provider 纯度、double-end 验收）
4. **Gemini 已验证能力** ← `.gemini/GEMINI.md` + `.gemini/scripts/ui-capture.sh` + `.gemini/skills/{ui-review, worktree-manager, openspec-*}`

凡 Claude 交付的代码、设计、文档、commit、PR，都必须能在上述四份文档下自洽。若产生冲突，按 `AGENTS.md §5.2` 末尾的边界表仲裁。

---

## 2) Claude 独占能力层（超越点）

这些是 codex CLI / gemini CLI 默认不具备、Claude Code 原生提供的能力。它们**不是可选增强**，而是 Claude 在本仓库的默认工作方式。

### 2.1 Skill-first 调度

- 任何会话的**第一个动作**是 `using-superpowers`；其后对每个非平凡任务，先判断是否有 skill 覆盖，再决定是否动手。
- 创作型任务（新 feature、新组件、行为修改）→ `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:test-driven-development`。
- 调试任务 → `superpowers:systematic-debugging`。
- 完成前 → `superpowers:verification-before-completion`（evidence-before-assertion，呼应 `AGENTS.md §6` 的"先证据后结论"）。
- 分派并行 → `superpowers:dispatching-parallel-agents`。
- OpenSpec 流 → `.gemini/skills/openspec-*` 全家桶仍然适用（Claude 通过 Skill tool 直接调用 gemini 已沉淀的脚本化 skill 也可，或走 openspec CLI）。
- UI review → `.gemini/skills/ui-review`（ui-capture.sh）。

**红线**：skill 已覆盖的工作流，Claude 不得凭感觉走捷径。`using-superpowers` 中的 Red Flags 表是硬约束。

### 2.2 Subagent 并行调度

- 2 个以上**真独立**任务 → 单条消息中并行发起 `Agent` 工具调用，且 prompt 必须自包含。
- 子代理类型优先级：`Explore`（代码勘探）> `Plan`（架构规划）> `general-purpose`（默认）> 专职代理（code-reviewer / plugin-validator / skill-reviewer 等）。
- **worktree 纪律传染**：若 subagent 会写代码，必须把 `AGENTS.md §6.1` / `§6.2` 的 worktree 纪律写入 prompt；或用 `isolation: "worktree"` 参数。
- Subagent 的 summary **只是意图**，不是事实；返回后 Claude 必须 `Trust but verify`（读 diff / 跑命令）再决定下一步。

### 2.3 Plan mode 与 openspec 联动

- 非平凡改动前默认 `EnterPlanMode` → 产出 plan → `ExitPlanMode` 等用户批准。
- Plan 中任何会触达 durable law 的条款，**必须同步更新** `openspec/changes/<change>/` 的 `design.md` / `tasks.md` / `spec.md`（呼应 `AGENTS.md §5.1 / §5.2`）。
- Plan 不是第二个 SPEC；长期法则只允许住在 `SPEC.md` / `packages/*/SPEC.md` / `openspec/specs/*`。

### 2.4 TaskCreate / TodoWrite

- 3 步以上的任务默认走 `TaskCreate`；完成即 `TaskUpdate`，不批量。
- Task 不替代 openspec change；`TASKS.md` 已退役（`AGENTS.md §5.1`），任务持久化仍以 `openspec/changes/*` 为真源。

### 2.5 Memory system（仅限 Claude session 间）

- 存储于 `/Users/kzf/.claude/projects/-Users-kzf-Dev-GitHub-jixoai-labs-agenter/memory/`。
- **绝不**用 memory 存储已在 AGENTS / DESIGN / SPEC / CLAUDE.md 中的规则；那会导致双真源。
- memory 只存：用户个人偏好反馈（feedback）、跨会话的非代码事实（reference / project 状态）。
- 读 memory 前必须校验它是否被仓库当前状态 override。

### 2.6 MCP 服务

| 服务         | 用途                                       | 约束                                         |
| ------------ | ------------------------------------------ | -------------------------------------------- |
| `context7`   | 第三方库 / 框架的**最新**官方文档          | 写依赖代码前默认使用；**不用于** refactor    |
| `pencil`     | `.pen` 设计文件读写                        | `.pen` 内容**加密**；禁止 `Read`/`Grep`      |
| `playwright` | 浏览器自动化（E2E、真实路由走查）          | 服从 `AGENTS.md §7` 双端走查契约             |
| `codedb`     | 索引式大仓库勘探（文件/符号/依赖/trigram） | 与 `Grep` / `Glob` 互补；大规模勘探优先      |

### 2.7 Hooks / settings.json

- 自动化需求（"每次 X 后 Y"）必须通过 `.claude/settings.json` 的 hooks 机制实现，不靠 memory 或 prompt 约束（harness 才能执行）。
- 个人偏好型自动化写 user settings；项目级自动化写项目 `.claude/settings.json`（当前未设，有需要再新建）。

---

## 3) Worktree 与隔离（继承 AGENTS §6.1 / §6.2）

- **唯一脚本源**：`./.gemini/scripts/wt-*.sh`；不重造 `.claude/worktrees/` 管理脚本。
- **两种进入方式**：
  - 复杂专题 / 需要 dirty snapshot / land-ff → `bash ./.gemini/scripts/wt-setup.sh <topic>`
  - 一次性快速实验 / 小幅隔离 → `EnterWorktree` 工具（自动使用 `.claude/worktrees/`，session 结束可选清理）
- 任一入口下，**merge-ready 必须绑定命名 ref、必须先 rebase、必须独立 verification worktree 跑 `--no-commit` merge、必须 ff-only 落地**（硬约束，见 `AGENTS.md §6.1`）。
- 纯前端任务：**before 截图先于实现**，`.screenshot/before/*` → 实现 → `.screenshot/after/*`，路由级证据优先于 Storybook 替身，**desktop + iPhone 14 双端**（`AGENTS.md §6.2`）。

---

## 4) Browser 走查 & UI 证据（继承 AGENTS §7）

- 双端硬约束：desktop + iPhone 14 mobile 都出证据；移动端走真实 compact 路径。
- 工具选择：`agent-browser`（CLI、适合 AI 走查）或 `playwright` MCP（适合脚本化断言）。
- 截图入口统一走 `./.gemini/scripts/ui-capture.sh <topic> <url> <wait_target> <before|after>`，产物在 `.screenshot/<topic>/`。
- 结果必须记录：`预期 / 实际 / 证据路径 / viewport / 是否通过`。

---

## 5) 设计文件写入（.pen）

- 读写唯一入口：`pencil` MCP tools（`get_editor_state` / `batch_get` / `batch_design`）。**禁止**用 `Read` / `Grep` 打开 `.pen`。
- 资产拓扑（`DESIGN.md §9`）：
  - `design/design-system.pen` — 原子组件
  - `design/webui/components.pen` — 跨 route 壳层
  - `design/webui/<route>.pen` — route-local 评审稿
- 每轮设计收敛必须同步更新 `openspec/changes/<change>/design.md` 或相关 `spec.md`；不能只改设计稿不改 OpenSpec。

---

## 6) 代码提交纪律

- 遵循 `/Users/kzf/.codex/git-committer.md`（用户全局标准）。
- commit 前必须通过 `superpowers:verification-before-completion`：`bun run typecheck` + 最相关测试子集跑绿；未验证**不得**声称"完成 / 修复 / 通过"。
- 新增或修改长期契约 → OpenSpec change 同步（见 `AGENTS.md §5.1`）。
- PR 描述：what changed + why + evidence links（screenshots、test logs、openspec change path）。

---

## 7) 用户全局偏好继承

用户 `~/.claude/CLAUDE.md` 中的**首席系统架构师**哲学、技术栈偏好（TypeScript strict / vitest / storybook / React 19 / tRPC / Hono / TanStack / Tailwind v4 / pnpm / rolldown / zod v4 / ts-pattern / idb / Dexie / nats / meilisearch / `@gaubee/*` / `node-windows/mac/linux`）、行为偏好（200 行文件边界、注释克制、TODO/FIXME 明示），在本仓库**默认生效**。

与仓库 AGENTS/DESIGN/SPEC 出现分歧时，**仓库真源优先**；用户偏好作为下限兜底。

---

## 8) 涌现价值与越界边界

Claude 相对 codex/gemini 的涌现收益，全部来自本文件 §2：skill-first 调度 + subagent 并行 + plan mode + MCP 组合。这些能力**叠加**在已有工程纪律上，而不是替代。

**越界信号（任一命中立即停手并与用户对齐）**：

- 想在 CLAUDE.md 里新增 durable law / 业务字段 / 页面 IA（应写进 SPEC / DESIGN / openspec/changes）。
- 想新建 `.claude/scripts/` 或复刻 `.gemini/scripts/` 能力。
- 想让 subagent 跳过 worktree 纪律 / 双端走查 / openspec 同步。
- 想用 memory 记住可以从代码/git/openspec 推出的事实。
- 想在 plan mode 外直接动 durable contract。

---

## 9) Bootstrap Checklist（每次进入仓库 ≤30s 完成）

1. `using-superpowers` 已加载（SessionStart 自动注入）。
2. 读过本文件。
3. 按需对目标模块打开 `packages/<pkg>/SPEC.md` + 相关 `openspec/changes/<active>/` + `design/webui/<route>.pen`。
4. 若涉及 UI，确认 `.screenshot/<topic>/` 目录约定可用。
5. 若涉及 worktree，确认 `./.gemini/scripts/wt-*.sh` 可执行。
6. 开工前按 §2.1 判断 skill 覆盖 → 按 §2.3 判断是否需要 plan mode。

本文件未覆盖的所有情境，回到 `AGENTS.md` / `DESIGN.md` / `SPEC.md` 查法则。
