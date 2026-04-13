## Why

WorkspaceSystem 现在已经有 mount/grant law，但规则文件系统仍然是 `app-server` 私有实现，既没有被抽成 just-bash 可复用原语，也还没有在 WebUI 里形成完整的 workspace management control plane。继续在现状上加功能，会把“规则层”与“产品层”一起锁死在 `app-server` 和单页实现里。

这一轮需要把 workspace rules 的底层法则正式抽成独立包，同时把 `/workspaces` 补成真正的管理入口，让 Avatar 挂载/卸载 workspace 的流程和 Explorer / Rules / Private 文件工作流并存，而不是继续把管理能力挤进 Avatar detail 或临时按钮里。

## What Changes

- 新增一个独立包 `just-bash-overlay-rule-fs`，提供基于 glob rule 的 `IFileSystem` 实现，支持 ordered rules、real path authority、avatar-private 隔离和动态规则配置。
- 把 `app-server` 的 workspace bash / root workspace bash 从私有 `GrantedWorkspaceFs` 迁移到新的 `just-bash-overlay-rule-fs` 包，统一规则层实现。
- 在 `/workspaces` 增加 `ManagementDialog`，用 workspace 视角管理 Avatar 的 mount / unmount 与 grants，而不是把这类操作塞回 Avatar detail。
- 为新的规则层与管理流程补验证：先跑命令行真实 AI 测试，再做浏览器走查。

## Capabilities

### New Capabilities
- `overlay-rule-fs`: A reusable just-bash filesystem layer that enforces ordered glob rules, avatar-private isolation, and dynamic rule reconfiguration over real paths.

### Modified Capabilities
- `workspace-system-capabilities`: Workspace bash and root workspace bash must enforce grants through the shared overlay-rule filesystem instead of app-server-private rule wrappers.
- `workspace-system-workbench`: The workspace workbench must expose a management dialog for Avatar mount / unmount and grant management in addition to Explorer / Rules / Private file workflows.

## Impact

- Affected code:
  - `packages/app-server/src/workspace-system/*`
  - `packages/webui/src/lib/features/workspaces/*`
  - real-AI validation and browser walkthrough harnesses
- New package:
  - `packages/just-bash-overlay-rule-fs`
- Dependencies / systems:
  - `just-bash`
  - WorkspaceSystem mount/grant enforcement
  - WebUI workspace management surface
