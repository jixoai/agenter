## Context

skills+CLI 架构已经把系统说明从大 prompt 拆出来了，因此“如何正确启动并验证一个本地服务”这类实践法则，最合适的承载面不是测试里不断堆更长的用户提示，而是 runtime 自带 skills。

当前失败模式是：

1. AI 会创建或恢复 terminal；
2. AI 会尝试写 server.js、启动服务；
3. 但它容易把 `terminal write` 的成功误判成“服务已可用”；
4. 于是 room 里先发了 `PROJECT-URL:`，真实 URL 仍然是 502。

## Decision

### 1. 把“交付前验证”升格为 runtime skill law

runtime skills 要明确表达：

- `terminal write` 只说明 terminal 接收了命令，不说明进程成功
- durable process launch 后必须先 `terminal read`
- 对外宣称交付前，必须用新的 `root_workspace_bash` 调用实际 `curl` 目标 URL 和关键标记

这条 law 比场景专属提示更高级，因为它能同时覆盖：

- 1 user + 1 avatar 本地交付
- project-room 多 avatar 协作交付
- 冷启动恢复后的再次交付

### 2. 把“URL announcement”定义成最后一步

skills 中给出固定 checklist：

1. create/recover terminal with explicit cwd
2. launch service inside terminal
3. `terminal read` to confirm the process did not crash immediately
4. `root_workspace_bash` curl the exact promised URL and markers
5. only then send `APP-URL:` / `PROJECT-URL:` / room delivery reply

这不是为了把平台硬编码成某个业务前缀，而是为了让 AI 理解“room announcement is a derived fact, not a guess”。

## Validation

- 调整 runtime built-in skills
- 真实 AI 回归 `real-project-room.integration.test.ts`
- 若仍不稳定，再考虑更强的平台约束，而不是继续堆测试提示词
