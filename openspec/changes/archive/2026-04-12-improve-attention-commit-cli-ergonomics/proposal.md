## Why

真实 AI 单 Avatar 交付场景已经完成了房间回复、终端启动和 URL 验证，但最后在 attention 收尾阶段卡死。根因不是业务没做完，而是 runtime shell 的 `attention commit` CLI 只接受 JSON payload，不接受 AI 很自然会写出来的 flag 形式，例如：

```bash
attention commit --context ctx-... --score 0 --summary "done"
```

同时 runtime-local attention API 虽然暴露了 `done` 字段，却没有真正执行“done 时把当前上下文未清零 scores 归零”的语义，导致 shell CLI 与内核内置 `attention_commit` tool 行为不一致。

这属于平台级人机工效和契约不一致问题，需要独立收口。

## What Changes

- `attention commit` shell CLI 新增常用 flag-form 输入，同时保留 JSON/stdin 作为完整 payload 入口
- 将 `done` 语义下沉到 runtime-local attention commit handler，使 shell CLI 与内置 tool 对“收尾即清零 active scores”的行为保持一致
- 为 runtime skills 增加 attention commit 的推荐写法，并增加回归测试与真实 AI 场景验证

## Capabilities

### Modified Capabilities
- `runtime-skills-cli-surface`: runtime attention CLI must support ergonomic shell commit flows and consistent done semantics

## Impact

- Affected code: `packages/app-server/src/runtime-cli.ts`, `packages/app-server/src/runtime-local-api.ts`, `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/runtime-skills.ts`
- Affected tests: workspace/runtime CLI coverage plus real room-terminal delivery validation
- Systems: AttentionSystem shell surface, runtime-local attention API, real AI convergence path
