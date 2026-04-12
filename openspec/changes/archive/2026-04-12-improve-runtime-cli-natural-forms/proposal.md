## Why

真实 AI 交付走查已经证明，当前 runtime CLI 对“模型最自然会写出的命令形式”不够宽容。模型在 `root_workspace_bash` 里会很自然地写出：

- `message send --room <chatId> --content "..."`
- `message read <chatId> --limit 10`
- `terminal write <terminalId> --input "..." --submit`
- `message send --help`

但当前 shell 只接受狭窄的 positional 语法，结果导致了三个真实问题：

- `APP-ACK` 被发成了 `--content APP-ACK: ...` 这种畸形消息，测试看不到合法确认
- `terminal write --input ...` 被 shell 当成普通命令文本，长期服务根本没有启动
- 模型为了自救要额外试错和查技能，真实外部 continuation rounds 被白白消耗

这不是“模型不够聪明”，而是平台壳层的人体工学不够好。既然 runtime CLI 是 AI 的 shell surface，就应该在不污染底层 API 真相的前提下，接住这些高频自然写法。

## What Changes

- 在 runtime shell CLI 层为高频命令增加自然 flag-form 兼容：
  - `message read` 支持 `--room/--chat/--chat-id` 和 `--limit`
  - `message send` 支持 `--room/--chat/--chat-id` 与 `--content/--text`
  - `terminal write` 支持 `--input/--text`
- 为 `message` / `terminal` / `attention commit` 提供最小可发现的 `--help` 输出，避免模型把 `--help` 当成业务参数再误打到真 API
- 保持 runtime-local API、密钥认证、attention completion 单一信源不变；兼容仅发生在 shell parser 层
- 补单测锁定这些自然写法，并重新执行真实 AI room+terminal 交付回归

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `runtime-skills-cli-surface`: runtime shell commands must accept common natural flag forms and expose minimal self-help for high-frequency room/terminal workflows

## Impact

- Affected code: `packages/app-server/src/runtime-cli.ts`, `packages/app-server/src/runtime-skills.ts`
- Affected tests: `packages/app-server/test/runtime-cli.test.ts`, `packages/app-server/test/runtime-skills.test.ts`, `packages/app-server/test/real-room-terminal.integration.test.ts`
- Systems: runtime shell CLI surface, runtime skills discoverability, real AI delivery validation
