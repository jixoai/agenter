## Why

真实 AI multi-avatar project-room 场景再次暴露出一个平台缺口：Avatar 已经学会用 room 里的固定前缀回复 `PROJECT-URL:`，但还没有稳定把“服务真的跑起来并且 curl 验证通过”作为先决事实。结果就是 room 叙述和真实交付状态分裂，用户拿到的 URL 仍可能是 502。

这不是 RoomSystem 的展示问题，而是 runtime skills 对 terminal durable launch / recovery / verification 的法则表达还不够硬。

## What Changes

- 强化 runtime built-in skills，明确 `terminal write` 只代表“输入已提交”，不代表“服务启动成功”
- 为 runtime/terminal/message skills 增加统一的本地交付 checklist：recover/create terminal -> launch durable process -> terminal read -> root workspace curl verification -> room announcement
- 用真实 AI multi-avatar project-room 场景回归，验证 delivery announcement 和真实服务状态重新对齐

## Capabilities

### Modified Capabilities
- `runtime-skills-cli-surface`: runtime skills must teach durable service launch verification before room delivery claims

## Impact

- Affected code: `packages/app-server/src/runtime-skills.ts`
- Affected tests: `packages/app-server/test/real-project-room.integration.test.ts`
- Systems: runtime built-in skills, terminal delivery workflow, room delivery truthfulness
