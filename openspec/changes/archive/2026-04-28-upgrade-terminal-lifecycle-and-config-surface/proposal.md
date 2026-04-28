## Why

当前 terminal surface 还缺两类关键法则：

- **并发协调法则缺失**
  - 多 Avatar 协作时，terminal 只有 `not_started / running / stopped`
  - 没有 `bootstrapping / killing` 这类中间态，调用方无法知道“这次生命周期变更已经在路上”，只能靠重试或猜测
  - 这会导致重复 bootstrap、重复 kill、以及 UI / AI 对同一个 terminal 做出互相冲突的下一步动作

- **config surface 缺失**
  - 现在 terminal create 可以一次性写入 `cwd / command / profile`
  - 但创建之后没有正式的 `terminal get-config / terminal set-config`
  - AI 和 operator 无法把 terminal 当成一个 durable collaboration asset 来检查或调整默认名称、宽高、启动命令、默认路径和其它元数据

这不是单个 CLI 子命令的缺漏，而是 terminal kernel 还没有把：

- durable launch/config truth
- transient lifecycle transition truth
- durable process lifecycle truth
- runtime observed identity truth

彻底分层。

## What Changes

- **BREAKING** Add explicit transient terminal lifecycle transitions for collaborative coordination:
  - `lifecycleTransition = "bootstrapping" | "killing" | null`
- Keep durable `processPhase` separate from transient transition truth:
  - `not_started | running | stopped`
- Clarify that lifecycle transitions are coordination locks only:
  - they prevent conflicting lifecycle mutations
  - they do **not** create terminal attention commits or unresolved debt by themselves
- Keep the public `terminal create` contract as `create + auto bootstrap` by default.
- Add runtime-local `terminal get-config` and `terminal set-config` so AI can inspect and mutate durable terminal launch truth after creation.
- Extend terminal help text and built-in terminal skill guidance so AI learns:
  - new terminals auto bootstrap on create
  - existing `stopped` or `not_started` terminals require explicit `terminal bootstrap`
  - `bootstrapping` / `killing` means wait, reread, and avoid stacking another lifecycle mutation
  - `terminal set-config` changes durable launch truth, while only selected fields such as geometry may also affect a live PTY immediately

## Capabilities

### Modified Capabilities

- `terminal-control-plane`: add transient lifecycle transitions and durable terminal config read/write.
- `runtime-terminal-contract`: publish transition truth and config truth separately from process phase and observed identity.
- `runtime-json-tool-descriptor-surface`: expose `terminal get-config` and `terminal set-config`, and teach the transition-aware lifecycle law in CLI help.
- `runtime-skills-cli-surface`: update built-in terminal skill and references so shell guidance matches create auto-bootstrap, stopped-terminal explicit bootstrap, and config inspection/mutation law.

## Impact

- `openspec/specs/terminal-control-plane/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
- `openspec/specs/runtime-skills-cli-surface/spec.md`
- `packages/terminal-system/src/*`
- `packages/app-server/src/*`
- `packages/terminal-system/skills/terminal/*`
- targeted BDD tests for terminal-system, runtime terminal adapter, runtime CLI, and built-in skill guidance
