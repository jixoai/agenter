## Why

当前 LoopBus 仍然把 attention 之外的大量 system prompt、system guide 和 direct tools 直接塞进 AI-call。这样一来，内核越来越像“替各个系统做提示词拼装器”，而不是一个只面向 attention 的执行内核；同时 message/workspace/terminal 的能力形态也和未来的 skills/cli 体系脱节。

这次改动要把内核做减法：LoopBus 只保留 attention law、skills 索引和 root workspace 原语，把其它 system 全部改成通过 CLI + skills + attention-scoped API 被 AI 自主发现和调用。

## What Changes

- **BREAKING** 将 LoopBus 的 model tool 面收缩为 root workspace 原语，只保留 `root_workspace_list` 与 `root_workspace_bash`
- **BREAKING** 移除 message / terminal / attention 的 direct model tools 注入路径，改为 bash 内 CLI 调用
- **BREAKING** 将 attention bootstrap 输入收缩为 `ContextSummary + AttentionContexts.metadata`，不再直接注入 system descriptions 与 rich attention detail body
- 为每个 runtime 增加独立的 attention-scoped local API，供 `attention/message/workspace/terminal` CLI 访问
- 为每个 avatar 固定挂载一个按 principal 地址命名的 root workspace：`~/.agenter/avatars/<principal>`
- 将 skills 发现改为 `skills.list + ccski info/search` 模式，skills source 固定来自 `~/.agents/skills`、`~/.agenter/skills` 与 `~/.agenter/avatars/<principal>/skills`
- 用真实路径语义替代 prompt-facing 虚拟路径，让 AI 在 just-bash 中看到的路径与宿主文件系统一致
- 补充真实 AI CLI 测试，并在 `.chat` 中沉淀前端对接说明与后续建议

## Capabilities

### New Capabilities
- `runtime-skills-cli-surface`: Define skills discovery, root workspace shell primitives, and attention-scoped CLI/API access for AI runtimes

### Modified Capabilities
- `attention-runtime-kernel`: Runtime prompt/tool/input shape changes from system-guide/direct-tool injection to attention law + skills list + root workspace primitives
- `workspace-system-capabilities`: WorkspaceSystem gains a fixed avatar root workspace and real-path multi-workspace bash execution semantics
- `avatar-runtime-topology`: Avatar runtime topology now includes a fixed principal-address root workspace in addition to dynamic workspace mounts

## Impact

- Affected code: `packages/app-server/src/agenter-ai.ts`, `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/app-kernel.ts`, `packages/app-server/src/workspace-system/*`, `packages/cli/*`, localized prompt docs, real AI harness/tests, and `.chat` backend/frontend integration notes
- Affected APIs: runtime snapshot payloads, root workspace tool contracts, new runtime-local attention API routes, and runtime shell environment variables
- Dependencies: `ccski` integration for skills discovery plus continued use of `just-bash`
- Systems: LoopBus kernel, AttentionSystem, WorkspaceSystem, MessageSystem, TerminalSystem, CLI runtime harness
