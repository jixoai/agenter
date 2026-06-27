## Why

`promote-ghostty-native-cli-shell` 已经把 terminal backend 的 durable truth 建到了 terminal-system、client-sdk 和 app-runtime，但 `app-server` 仍然留着一段残缺投影：runtime terminal view、runtime-local descriptor handler、browser-authenticated global terminal create/set-config schema，还没有把同一个 `backend` 字段完整暴露出来。

这会导致平台法则断裂。terminal-system 明明已经把 backend 作为 launch truth 持久化，但 `app-server` 这层仍然要求调用方从 renderer、默认值或产品上下文去猜 backend，破坏了 “backend truth 与 renderer truth 分离” 的既有系统法则。

本 change 只收口这个残留缺口。它不重新设计 cli-shell，不改动 Termless backend ownership，也不实现 `extend-attention-cli-self-evolution-runtime`。

## What Changes

- 补齐 `app-server` runtime terminal projection，让 runtime terminal list / create ack / get-config / set-config mutation 都显式携带 `backend`。
- 补齐 runtime-local tool descriptor 与 browser-authenticated tRPC terminal create/set-config schema，使它们复用 terminal-system 已有的 backend enum contract。
- 为 remote placeholder terminal projection 提供显式 backend 占位真相，避免客户端在 mixed local/remote terminal surface 中遇到缺字段分支。
- 增加针对 `app-server` terminal runtime/public surface 的测试，验证 backend truth 可通过 create/list/get-config/set-config 全链路观察到。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-terminal-contract`: runtime terminal projection 需要把 backend durable truth 暴露到 list/create/get-config/set-config surface。
- `runtime-json-tool-descriptor-surface`: runtime terminal create/set-config descriptor surface 需要接受并说明 explicit backend field。
- `terminal-control-plane`: app-server 对外投影必须忠实保留 control-plane 已有的 backend launch truth，而不是局部省略。

## Impact

- `packages/app-server/src/app-kernel.ts`
- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/runtime-tool-views.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/trpc/router.ts`
- `packages/app-server/test/managed-terminal.test.ts`
- `packages/app-server/test/runtime-tool-views.test.ts`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
- `openspec/specs/terminal-control-plane/spec.md`
