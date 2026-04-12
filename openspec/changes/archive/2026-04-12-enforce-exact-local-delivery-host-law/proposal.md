## Why

真实 AI 交付回归里，CLI 自然语法问题修完后，新的失败暴露得很清楚：Avatar 把服务跑在了 `localhost` / `[::1]`，然后用 IPv6 成功结果去冒充 `http://127.0.0.1:<port>/` 的成功，最终提前发送了 `APP-URL`。

这不是网络栈的小细节，而是交付契约被偷换了。对用户来说：

- `127.0.0.1`
- `localhost`
- `[::1]`

不是同一个事实。既然房间里承诺的是精确 URL，那么 host 和 port 都属于单一信源的一部分，不能“差不多就算成功”。

当前 runtime skills 虽然已经说了“验证 exact URL”，但真实模型仍然会自己加 fallback，把 `[::1]` 的成功当成 `127.0.0.1` 的成功。这说明这条法则还不够硬，缺少反例和明确的 host-binding 说明。

## What Changes

- 强化 runtime built-in skills，把“host/port 都属于交付契约”的 law 写成显式规则
- 明确声明 `127.0.0.1`、`localhost`、`[::1]` 不能互相替代；如果承诺的是 `127.0.0.1`，那 `[::1]` 成功不算交付成功
- 给 `python3 -m http.server` 这类常见本地服务增加明确绑定示例：当契约指定 `127.0.0.1` 时必须显式 `--bind 127.0.0.1`
- 补技能文案回归测试，并重新跑真实 AI room-terminal 交付验证

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `runtime-skills-cli-surface`: runtime skills must teach exact local URL host binding as part of delivery truth, not an optional implementation detail

## Impact

- Affected code: `packages/app-server/src/runtime-skills.ts`
- Affected tests: `packages/app-server/test/runtime-skills.test.ts`, `packages/app-server/test/real-room-terminal.integration.test.ts`
- Systems: runtime skills discoverability, local URL delivery law, real AI delivery validation
