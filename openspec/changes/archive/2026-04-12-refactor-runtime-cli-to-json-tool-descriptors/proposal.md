## Why

当前 runtime shell surface 已经偏离了“单一信源”原则：`runtime-local-api.ts`、`runtime-cli.ts`、`runtime-skills.ts` 分别维护 route、解析规则、帮助文案与示例，导致同一个 attention/message/workspace/terminal 能力被写了多份真相。上一轮为了接住自然 flag form 做的兼容已经证明，这种 façade 级补丁会继续放大分叉，而不是收敛平台法则。

这次需要做破坏性回收：把 runtime shell/API 收敛成 descriptor 驱动的 JSON-only contract。这样 CLI、loopback-local API、`--help`、skills 示例都从同一份工具描述生成，后续要接 HTTP/OpenAPI 也不需要再复制一层。

## What Changes

- 新增 shared runtime tool descriptor registry，统一定义 `attention` / `message` / `workspace` / `terminal` 的：
  - namespace + subcommand 名称
  - 描述文案
  - `inputSchema`
  - loopback-local route
  - handler / 示例
- **BREAKING**：runtime CLI 改为 JSON-only
  - 不再接受 positional / flag shorthand / natural-form adapter
  - 只接受三种输入形态：空输入、单个 JSON argv、JSON stdin
- `--help` 改为 descriptor 驱动，直接输出 description + input schema + canonical examples
- runtime built-in skills 改成 JSON-only 示例，并明确告诉 AI 先用 `--help` / `ccski info` 做渐进发现
- 重写相关单测，并重新执行真实 AI room+terminal 验证，确认模型可以用 JSON CLI 完成真实交付链路

## Capabilities

### New Capabilities

- `runtime-json-tool-descriptor-surface`: 用同一份 tool descriptor 驱动 runtime local API、shell CLI、help、skills 示例与后续 HTTP/OpenAPI 扩展

### Modified Capabilities

- None

## Impact

- Affected code:
  - `packages/app-server/src/runtime-cli.ts`
  - `packages/app-server/src/runtime-local-api.ts`
  - `packages/app-server/src/runtime-skills.ts`
  - new shared descriptor module(s) under `packages/app-server/src/`
- Affected tests:
  - `packages/app-server/test/runtime-cli.test.ts`
  - `packages/app-server/test/runtime-skills.test.ts`
  - shell/runtime tests that still use legacy flag or positional syntax
  - `packages/app-server/test/real-room-terminal.integration.test.ts`
- Systems:
  - runtime local API
  - root workspace shell CLI
  - runtime skills discoverability
  - future HTTP/OpenAPI adapter path
