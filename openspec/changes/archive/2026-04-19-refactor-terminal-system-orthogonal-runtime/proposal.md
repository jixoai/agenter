## Why

`terminal-system` 目前把终端 runtime、授权/审批、transport、客户端投影、以及 WebUI 壳层揉成一条长耦合链。结果是 inspection 原语带副作用、seat/activity 真源重复、以及前端交互 bug 难以通过局部修复收敛。

现在需要一次明确的 breaking refactor，把这些职责重新拆回正交原子，并用 BDD 场景锁定新的平台法则，避免继续在当前链路上堆补丁。

## What Changes

- **BREAKING** 将 terminal runtime 与 catalog/access/projection 拆分成独立服务边界，`TerminalControlPlane` 收敛为 orchestration facade。
- **BREAKING** 重写 `terminal_read` / `terminal_snapshot` inspection 契约，使其成为纯读原语；读取不再隐式启动终端、不再偷偷创建 bootstrap grant。
- **BREAKING** 将 terminal surface 的 seat/access/runtime projection 统一由服务端与 store 组合输出，WebUI route 不再自行 merge `access + grants + actors`。
- **BREAKING** 将 `terminal-view` 收敛为纯终端 viewport primitive，移除产品级 titlebar/footer/background/shell 责任。
- 用 BDD-first 补齐 terminal-system、client runtime store、以及 WebUI Storybook DOM 合同测试，替换低价值源码字符串断言。

## Capabilities

### New Capabilities

- `terminal-surface-projection`: 统一 catalog/runtime/access/activity 到面向 client/WebUI 的只读投影能力。

### Modified Capabilities

- `terminal-control-plane`: inspection、lifecycle、authorization、approval history 的 requirement 改为纯 runtime 原语 + 显式 orchestration。
- `runtime-terminal-contract`: runtime 发布 terminal 读模型与 surface invalidation 的 requirement 发生变化。
- `terminal-system-surface`: terminal route、tool composer、users pane、viewport restore 的 requirement 改为基于统一 surface projection 与真实 DOM contract。
- `terminal-view-component`: terminal-view 改为纯 viewport primitive，不再内建产品级 chrome。

## Impact

- Affected code: `packages/terminal-system`, `packages/app-server`, `packages/client-sdk`, `packages/terminal-view`, `packages/webui`
- Affected APIs/types: `TerminalControlPlane`, `TerminalReadResult`, global terminal DTOs, runtime-store terminal resource APIs, WebUI terminal surface props
- Affected tests: terminal-system integration/control-plane tests, client-sdk runtime-store tests, terminal-view tests, WebUI Storybook DOM tests
- Dependencies/systems: OpenSpec specs for terminal capabilities, Bun PTY runtime, xterm transport/rendering, app-server realtime invalidation
