## Why

真实 AI 交付链路里，`root_workspace_bash` 被设计成“最终自测”的 one-shot shell。但当前它在访问一个根本没监听的 loopback URL 时，会把连接失败伪装成 `502` 且 `exitCode=0`。这会让 AI 把“服务没起来”误判成“只是返回了一个 HTTP 状态码”，从而把错误 URL 当成交付事实发到 room 里。

## What Changes

- 修正 root workspace shell 的网络失败语义：连接拒绝、超时、DNS/transport 失败必须表现为命令失败，而不是伪造 HTTP 成功路径
- 保留 root workspace `curl` 的成功校验能力，但让 dead localhost / failed transport 在 stdout、stderr、exitCode 上都可判别
- 为 root workspace `curl` 增加明确的回归测试，覆盖 dead port 与 live loopback server 两类结果

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `workspace-system-capabilities`: root workspace one-shot network verification must preserve transport failure semantics instead of fabricating successful-looking HTTP results

## Impact

- Affected code: `packages/app-server/src/workspace-system/root-exec.ts`
- Affected tests: `packages/app-server/test/workspace-system.test.ts`
- Systems: WorkspaceSystem root workspace shell, real AI delivery verification flow
