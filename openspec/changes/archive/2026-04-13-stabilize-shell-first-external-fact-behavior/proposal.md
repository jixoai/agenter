## Why

真实 AI 的“外部事实”任务仍然不够稳定。当前 runtime law 已经足够克制，只暴露 `skills.list`、`root_workspace_list` 和 `root_workspace_bash`，但 Avatar 仍然可能没有自然地意识到：

- 自己应该像 Linux 工程师一样处理客观事实任务
- root workspace shell 可以访问外部网络
- 这类任务应该先通过 shell 做客观验证，再回复用户

继续往 skills 或 system prompt 里堆更长的“天气怎么查”“联网怎么查”的步骤，会让系统更容易过拟合，也更容易把 Avatar 训成只会背 workflow 的工具调用机器。  
这一轮要做的是把“人格与思维方式”收回到 `AGENTER.mdx`，再用一个测试专用 Avatar 去验证这种 shell-first 外部事实行为是否真的稳定成立。

## What Changes

- 调整共享 Avatar prompt law，让 `AGENTER.mdx` 明确塑造一种 shell-first、Linux 工程师式的外部事实处理偏好，而不是继续往 skills 里堆 query recipe。
- 调整 runtime skill guidance，让 runtime / shell 相关技能与引用文档只客观说明“one-shot shell 可联网、可做客观验证”，但不内联固定的天气或搜索脚本。
- 为 real-provider backend validation 增加“测试专用 Avatar + 专用 `AGENTER.mdx`”的外部事实场景与诊断输出，验证 Avatar 是否会自然地先 ack、再 shell 验证、再语义回复、最后收敛 attention。

## Capabilities

### Modified Capabilities
- `avatar-prompt-guidance`: shared Avatar prompt law must bias external-fact tasks toward objective shell verification through `AGENTER.mdx`, not memory-backed guessing.
- `runtime-skill-progressive-disclosure`: runtime skills and references must state shell networking as a factual capability without expanding into rigid query recipes.

### New Capabilities
- `real-ai-external-fact-validation`: real-provider validation for shell-first external fact tasks using a dedicated test Avatar and durable diagnostics.

## Impact

- Affected code:
  - `packages/i18n-en/prompts/AGENTER.mdx`
  - `packages/i18n-zh-Hans/prompts/AGENTER.mdx`
  - `packages/app-server/skills/runtime/**`
  - `packages/app-server/test/real-loopbus.integration.test.ts`
  - `packages/app-server/test-support/real-*`
- Affected systems:
  - Avatar prompt assembly
  - runtime built-in skill guidance
  - real-provider backend validation
