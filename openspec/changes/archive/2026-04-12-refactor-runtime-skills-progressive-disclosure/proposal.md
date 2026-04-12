## Why

当前 runtime built-in skills 已经拆回 package-owned source，但内容形态仍然偏“长篇操作手册”：多个 skill 同时承接跨系统细节、底层可靠性补丁和重复 checklist，违背了 skill 应该“短、明确、按需展开”的最佳实践。与此同时，`ccski info` 已经能返回真实的 `SKILL.md` 路径，但全局 prompt 还没有把“沿着真实路径去读 sibling references 文档”这条使用方法明确教给 AI。

这次需要做一次 skills authoring law 的收口：让 `SKILL.md` 回到 concise overview + trigger/when-to-use + minimal checklist，把详细材料下沉到 `references/`，并让全局 system prompt 把 `skills.list -> ccski info -> cat references/*.md` 固化成标准发现路径。

## What Changes

- 新增 runtime skill progressive-disclosure contract：
  - `SKILL.md` 只保留用途、触发时机、最小工作法则、references 入口
  - 详细流程、扩展说明、范例、背景约束下沉到 sibling `references/*.md`
- 重写现有 built-in runtime skills：
  - `agenter-runtime`
  - `agenter-workspace`
  - `agenter-collaboration`
  - `agenter-attention`
  - `agenter-message`
  - `agenter-terminal`
- **BREAKING**：built-in skills 不再把跨系统 delivery / network / room settlement 细节重复内联到各原子 skill 中；这些 skills 只保留自身职责边界内的信息
- 更新 runtime system prompts / skill list discoverability：
  - 明确告诉 AI：`ccski info <skill>` 会返回真实 `SKILL.md` 路径
  - 如果需要更深资料，优先按 skill 内列出的 `references/*.md` 用 shell 按需读取
  - 只读取需要的 reference file，而不是把所有文档整包灌进上下文
- 补充测试，锁住 skill 渐进发现结构和关键提示词

## Capabilities

### New Capabilities
- `runtime-skill-progressive-disclosure`: Runtime built-in skills use concise overviews plus sibling references, and global prompts teach AI to expand skill details through real file paths returned by `ccski info`.

### Modified Capabilities
- None

## Impact

- Affected code:
  - `packages/app-server/skills/**`
  - `packages/attention-system/skills/**`
  - `packages/message-system/skills/**`
  - `packages/terminal-system/skills/**`
  - `packages/i18n-en/prompts/AGENTER_SYSTEM.mdx`
  - `packages/i18n-zh-Hans/prompts/AGENTER_SYSTEM.mdx`
  - `packages/i18n-en/prompts/RESPONSE_CONTRACT.mdx`
  - `packages/i18n-zh-Hans/prompts/RESPONSE_CONTRACT.mdx`
  - `packages/app-server/src/runtime-skills.ts`
- Affected tests:
  - `packages/app-server/test/runtime-skills.test.ts`
  - `packages/app-server/test/runtime-cli.test.ts`
  - new prompt/skill structure assertions as needed
- Systems:
  - runtime built-in skills authoring model
  - AI skill discovery path
  - prompt-time context hygiene
