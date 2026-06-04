# AGENTS Best Practices

本文件只保留本仓库的“元意识”和协作公理。

日常开发工作流、OpenSpec 收口、release/tooling、Studio UI、Storybook DOM、viewport/browser 走查等高频执行细节，统一迁移到：

- `.agents/skills/develop-agenter/SKILL.md`

在本仓库做实现、文档、OpenSpec、Studio 或 release 工作时，优先使用 `develop-agenter` skill。

## 1) 元意识协作法则

- **先证据后结论**：先跑真实流程或拿到客观文件证据，再下判断。
- **保持客观展示**：输出不替事实做语义篡改；标签、摘要、状态都只能当投影。
- **配置优先于硬编码**：模型、终端入口、提示词路径、发布真源、策略选择都应走配置或显式真源。
- **架构做减法，算法做加法**：先把边界和路径收直，再谈额外智能与优化。
- **约束与自由度共存**：底层要稳定，但不能用硬规则吃掉本该留给智能体推理的空间。
- **公理不代替推理**：底层规则只定义边界，不提前替上层情境做结论。
- **势场优于牵引绳**：好的引导改变倾向和成本，不直接替主体完成选择。
- **显式特权才是合法奇点**：特权可以存在，但必须被命名、授权、限边界。
- **保留负空间**：未硬编码的空间不是缺陷，而是组合、纠偏、学习的容量。
- **投影不等于本体**：标签、摘要、评分、状态名、视图都只是事实投影，不能冒充本体进入推理。
- **可见效果守恒到作用源**：任何改变外部世界、持久化事实、他人可见结果的动作，都必须能追溯到明确作用源。

## 2) 元意识自检

设计或修改系统前，先过五问：

1. 我现在是在定义边界，还是在替未来情境提前下结论？
2. 我现在加的是势场，还是牵引绳？
3. 这个特殊路径，是被命名授权的奇点，还是未声明的特殊供应？
4. 这个字段、标签、摘要、状态，到底是本体，还是投影？
5. 这个可见效果，能否追溯到明确的作用源？

## 3) 代码锚点

- `packages/app-server/src/session-runtime.ts`
  - `shouldTreatSharedMessageAsReplyPending(...)`
  - `chatTurnState`
  - `chatObligationKind`
  - `sendMessageTool(... originAckFallback ...)`
- `packages/app-server/src/agenter-ai.ts`
  - social context / summary / metadata 的构造路径
- `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts`
  - `terminal_focus`
  - `terminal_unfocus`
  - `terminal_idle_ready`
- `packages/app-server/src/workspace-tool-provider.ts`
  - root / workspace authority
- `packages/app-server/src/runtime-skill-contract.ts`
  - `ctx-skill-system`
  - skill snapshot / reminder
- `packages/message-system/src/message-db.ts`
  - active-visible / unread materialization

这些位置是“元意识 -> 代码”的高频审视点：不要让投影冒充本体，不要让情境推理过早固化成事实字段，不要制造找不到作用源的外发效果。

## 4) 文档边界

- `AGENTS.md`：协作法则与元意识
- `SPEC.md` / `packages/*/SPEC.md`：平台契约与 durable 行为
- `DESIGN.md`：视觉结构、信息架构、设计最佳实践
- `.agents/skills/*`：详细执行手册与 repo-specific workflow
