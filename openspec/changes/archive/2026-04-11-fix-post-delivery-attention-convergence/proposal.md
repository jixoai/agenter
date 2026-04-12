## Why

真实 AI 交付链路里，Avatar 已经完成了真实副作用并把最终 URL 发回 room，但 runtime 仍可能继续自唤醒直到超时。走查后发现有两类原因叠加：一类是 runtime 自己写入的 lifecycle commits 仍会留下无意义的 unresolved debt；另一类是当前最小 attention bootstrap 下，`skills.list` 没有把“先查 attention，再显式 settle”这条路径说得足够直白，导致真实模型偶发地完成交付却不收尾。

这个问题现在必须处理，因为主 change 的收尾标准不是“偶尔能交付”，而是“真实 AI 交付后 attention 能稳定收敛”，否则后续冷启动恢复、多 Avatar 协作都会继续带着同样的尾部噪音。

## What Changes

- 将 runtime 产生的通用 lifecycle attention 从“活跃 debt”降为“可查询历史事实”，避免 `terminal_create`、focus/config 这类内部记账继续制造自唤醒 obligation
- 保留真正有动作含义的显式 attention debt；尤其不把 `message send` 自动推断为完成，room 任务仍然必须通过 `attention commit --done/--score 0` 显式收尾
- 强化 `skills.list` 与内置 `agenter-attention` / `agenter-runtime` 技能文案，让 AI 在只拿到 `AttentionContexts.metadata` 时，能更稳定地发现“先 `attention list/query`，后 `attention commit`”的路径
- 为 lifecycle debt 收敛与 skills discoverability 增加回归测试，并用真实 AI delivery/debug 场景重新验收收敛结果

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `attention-runtime-kernel`: internal lifecycle bookkeeping must stay observable without manufacturing unresolved scheduling debt
- `runtime-skills-cli-surface`: skills.list and built-in runtime skills must make debt-only attention inspection and explicit settlement discoverable under minimal bootstrap

## Impact

- Affected code: `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/runtime-skills.ts`
- Affected tests: `packages/app-server/test/session-runtime.attention-system.test.ts`, `packages/app-server/test/runtime-skills.test.ts`, real AI delivery/debug validation commands
- Systems: Attention runtime kernel, runtime skills/CLI surface, real AI convergence validation
