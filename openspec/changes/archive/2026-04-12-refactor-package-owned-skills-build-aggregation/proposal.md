## Why

当前 runtime built-in skills 的真源仍然集中在 `packages/app-server/src/runtime-skills.ts` 里，导致 attention/message/terminal 等原子系统无法在自己的包内维护自己的技能说明。更糟的是，runtime 还会把这些平台内置技能写进 `<rootWorkspace>/skills`，把“平台法则”与“用户/Avatar 私有技能资产”混在同一个空间里。

这需要一次破坏性收口：把 built-in runtime skills 的真源下放到各自包内的 `skills/**/SKILL.md`，再通过构建聚合为 runtime 可消费的 catalog。这样 package ownership、workspace asset ownership、以及 runtime prompt/ccski discoverability 三者才能重新正交。

## What Changes

- 新增 package-owned runtime skill source 约定：各子包在自己的 `skills/**/SKILL.md` 中维护 runtime-facing built-in skill 文档。
- 新增 runtime skill catalog build step，扫描各包 skill source，生成 app-server 可直接消费的 built-in catalog。
- **BREAKING**：runtime 不再把内置技能 materialize 到 `<rootWorkspace>/skills`；该目录只保留用户/Avatar 自己持有的 skill artifacts。
- 重构 `runtime-skills.ts`：
  - built-in skills 改为读取聚合 catalog
  - runtime slot（例如 principal id、root workspace path、descriptor examples）在读取时渲染，不再用手写大 `switch`
  - `ccski list/info/search` 同时展示 built-in catalog 与 shared/global/avatar on-disk skills
- 新增单测覆盖 package skill aggregation、runtime skill rendering、discoverability precedence，并重新跑真实 AI 集成验证。

## Capabilities

### New Capabilities
- `runtime-builtin-skill-catalog`: Package-owned SKILL sources are aggregated into one runtime built-in skill catalog, and runtime discoverability reads built-ins from that catalog instead of writing them into avatar root workspace storage.

### Modified Capabilities
- None

## Impact

- Affected code:
  - `packages/app-server/src/runtime-skills.ts`
  - `packages/app-server/src/session-runtime.ts`
  - new runtime skill catalog builder / generated manifest under `packages/app-server/`
  - new `skills/**/SKILL.md` under `packages/app-server/`, `packages/attention-system/`, `packages/message-system/`, `packages/terminal-system/`
- Affected tests:
  - `packages/app-server/test/runtime-skills.test.ts`
  - new builder/catalog tests under `packages/app-server/test/`
  - real AI delivery regression tests that inspect `ccski info` / bash usage
- Systems:
  - runtime built-in skill discovery
  - root workspace ownership boundary
  - prompt bootstrap through `skills.list`
