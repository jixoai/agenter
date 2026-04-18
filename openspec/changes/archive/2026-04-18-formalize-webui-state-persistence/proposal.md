## Why

当前 WebUI 的界面状态还没有一个统一的持久化法则：有些状态是临时内存，有些散落在 `localStorage`，有些已经值得跨设备同步，但系统并没有先定义“该不该持久化”“持久化之后该放客户端还是服务端”的平台边界。继续沿着 feature 各自补存储，只会把 tabs、pins、draft、viewer preferences 混成一团，后续越来越难收口。

现在后端已经具备 actor-private 的通用 KV 面，因此需要趁早把 WebUI state ownership law 定下来：只有真正有跨端同步价值的 durable state 才进入服务端；没有同步价值但值得持久化的状态留在客户端；只是会话期 UI 读态或交互态则留在内存。与此同时，create draft 这类可恢复的长寿命表单状态不应继续塞进 opaque KV，而应提升为 first-class draft resource。

## What Changes

- Add a durable WebUI state-ownership law that classifies state into `memory`, `client-local persistent`, `server-synced KV`, and `draft resource`.
- Use cross-device sync value as the deciding rule for client-vs-server persistence instead of implementation convenience.
- Keep workbench open-tab projections device-local by default, while allowing actor-level pinned collections and similar cross-device preferences to sync through the auth-scoped server KV plane.
- Introduce a first-class auth-scoped draft resource plane for resumable WebUI create flows, starting with avatar creation drafts.
- Migrate the first concrete surfaces to the new law:
  - running-avatar pins move from browser-local storage to server KV
  - workbench tabs remain device-local persistence
  - avatar create form state stops using browser-local tab payload as source of truth and moves to draft resources

## Capabilities

### New Capabilities
- `webui-state-persistence`: Defines the durable ownership law for WebUI state and the boundary between memory, client-local persistence, server KV, and draft resources.
- `webui-draft-resources`: Defines auth-scoped typed draft resources for resumable create/edit flows.

### Modified Capabilities
- `workbench-tabs`: Workbench open-tab presence becomes explicitly device-local even when the underlying resource is durable and cross-device.
- `workspace-avatar-management`: Avatar creation flows use durable draft resources instead of browser-local scratch state as their truth source.

## Impact

- `packages/app-server/src/auth-kv-*`
- `packages/app-server/src/app-kernel.ts`
- `packages/app-server/src/trpc/router.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `packages/client-sdk/src/types.ts`
- `packages/webui/src/lib/features/shell/*`
- `packages/webui/src/lib/features/avatars/*`
- `openspec/specs/workbench-tabs/spec.md`
- `openspec/specs/workspace-avatar-management/spec.md`
