## Why

当前 WorkspaceSystem 把 grant 建模成 `relativePath -> absolutePath` 的目录根列表，这和用户明确的授权法则不一致：

- 授权应该是类似 `.gitignore` 的有序 glob 规则，而不是“授予一个目录根”
- 规则需要表达 `ro` / `rw` 的覆盖顺序，不能退化成“只要在某个根下面就算允许”
- shell / workbench / terminal cwd 解析都必须共享同一套判权结果，不能各自用目录前缀猜权限

更严重的是，当前 workspace bash 实际会把整个 workspace 以只读方式挂进去，再给部分子目录叠加可写层。这意味着“未授权路径仍然可读”，平台法则已经被执行面绕开。

## What Changes

- **BREAKING** Workspace grant 输入与持久化模型从 `relativePath` 升级为 `pattern + mode + order`
- WorkspaceSystem 使用有序 glob 规则做路径判权，默认 deny，采用 last-match-wins
- 非 magic 模式的路径规则按“目录自身 + 全部后代”解释，和 gitignore 风格的目录授权保持一致
- workspace bash、root workspace bash、terminal cwd 校验、workbench explorer/preview、runtime CLI projection 全部改为复用同一套 grant evaluator
- 增加 snapshot migration 与回归测试，确保旧的 root-path grants 能自动迁移到新规则模型

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `workspace-system-capabilities`: runtime workspace grants become ordered glob rules with default-deny evaluation

## Impact

- Affected code:
  - `packages/app-server/src/workspace-system/*`
  - `packages/app-server/src/app-kernel.ts`
  - `packages/app-server/src/session-runtime.ts`
  - `packages/app-server/src/runtime-tool-views.ts`
  - `packages/app-server/src/workspace-workbench.ts`
  - `packages/client-sdk/src/*`
  - `packages/webui/src/lib/features/workspaces/*`
- Affected APIs:
  - `workspace.grantRuntime`
  - `workspace.runtimeGrants`
  - runtime CLI `workspace list`
- Systems:
  - WorkspaceSystem grant persistence
  - root workspace shell surface
  - workspace workbench rule editor
