## Why

真实 AI 的多 Avatar project-room 场景暴露出一个平台级误导口：AI 可以在 `root_workspace_bash` 里用 `&` 启动一个看似“后台常驻”的服务，但这个 one-shot shell 并不是 durable process host，结果房间里以为已经交付，实际用户只拿到 502。

现在需要把“长期进程只能属于 TerminalSystem”升级成明确法则，避免 one-shot bash 继续伪装成可恢复的进程托管面。

## What Changes

- **BREAKING** `root_workspace_bash` 与其它 one-shot workspace bash 执行面在遇到后台化语句时直接拒绝执行，并明确引导调用方改用 `terminal create` / `terminal write` / `terminal read`
- 为 AI 的 runtime skills 与系统 prompt 增加明确规则：one-shot bash 只负责一次性检查、文件操作与 URL 验证，不负责长期进程托管
- 增加回归测试，覆盖 one-shot bash 后台语句拒绝与真实 multi-avatar project-room 场景

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `workspace-system-capabilities`: one-shot bash execution must reject background process hosting and reserve durable processes for terminal sessions

## Impact

- Affected code: `packages/app-server/src/workspace-system/*`, `packages/app-server/src/runtime-skills.ts`, localized `AGENTER_SYSTEM` prompts, workspace system tests, and real project-room validation
- Affected APIs: one-shot bash stderr/exit semantics when callers attempt background persistence
- Systems: WorkspaceSystem shell surface, TerminalSystem recovery model, runtime prompt guidance
