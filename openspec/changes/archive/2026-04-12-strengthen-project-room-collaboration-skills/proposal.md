## Why

真实 AI 的 multi-avatar project-room 场景暴露出另一个独立问题：在共享房间里，Avatar 还没有稳定遵守“单一信源 + 角色边界 + 用户纠错后重发”的协作法则。结果表现为：

- frontend 会发不合格的 `API-QUESTION`
- backend 会越权或过早定义错误契约
- 被用户指出无效后，Avatar 仍可能继续沿着旧事实回复

这说明仅靠场景里的用户消息和私有 primer 还不够，runtime 本身需要把 shared-room collaboration law 作为一等 skills 提供给 AI。

## What Changes

- 为 runtime built-in skills 增加一个专门的 collaboration skill
- 在 skills.list summary 和 skill body 中明确协作法则：
  - 房间消息是 durable truth
  - 只说自己职责范围内的已验证事实
  - 合同归属谁，谁才是单一信源
  - 用户指出某条消息无效后，应直接发送纠正后的替代消息，而不是继续解释旧消息
- 增加回归测试覆盖 built-in collaboration skill 暴露与核心法则文本

## Capabilities

### Modified Capabilities
- `runtime-skills-cli-surface`: runtime skills must expose shared-room collaboration law as a discoverable built-in skill

## Impact

- Affected code: `packages/app-server/src/runtime-skills.ts`
- Affected tests: new runtime skills regression plus real multi-avatar collaboration validation
- Systems: runtime built-in skills, room collaboration behavior, shared-room contract discipline
