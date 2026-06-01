# Implementation Notes

## Apply Alignment

- `plans/plan.md`, package spec, example spec, and deferred Studio migration spec agree on package ownership, grouped Heartbeat truth, `readonly | configable`, mobile-first example acceptance, and first-phase Studio migration deferral.
- Avatar catalog rows are HeartbeatPage targets regardless of running state. Running only changes live-push/active status.
- `AgenterHeartbeatConnection` is the first accepted connection boundary name.
- First apply does not add or reshape backend endpoints. If an endpoint shape change appears necessary, implementation must pause for user discussion.
- `readonly` is a frontend presentation mode for clean UI. It is not an auth or isolation boundary. Existing `createSession({ autoStart:false })` remains allowed for materializing/reusing stopped session metadata so persisted Heartbeat DB facts can be read.
- User decision to preserve verbatim: "readonly只是前端上的限制，目的只是为了让界面干净点，真正要做隔离，也不是从接口设计上去隔离，而是要从接口认证上去隔离。"

## `packages/web-chat-view` Files To Mirror

- Mirror package shape:
  - `packages/web-chat-view/package.json`
  - `packages/web-chat-view/tsconfig.json`
  - `packages/web-chat-view/svelte.config.js`
  - `packages/web-chat-view/vitest.config.ts`
  - `packages/web-chat-view/.storybook/main.ts`
  - `packages/web-chat-view/.storybook/preview.ts`
- Mirror package/example boundary:
  - package owns reusable Svelte primitives and typed exports
  - `example` owns Framework7 host shell, app bootstrap, routes, and connection UI
- Mirror Framework7 runtime helpers only if needed:
  - `src/framework7-components.ts`
  - `src/framework7.ts`
  - `src/framework7-host.ts`
- Intentionally diverge:
  - no chat composer, contacts, search, resource preview, or CodeMirror dependencies in first Heartbeat package slice
  - example root is Avatar directory first, not the web-chat review shell

## Studio Heartbeat Files To Migrate Or Recreate

- Copy/reorganize into package-owned code:
  - `runtime-heartbeat-parts.ts`
  - `runtime-heartbeat-tool-visual-hints.ts`
  - `runtime-heartbeat-statusbar-state.ts`
  - `runtime-heartbeat-config-state.ts`
  - `runtime-shell-format.ts` time-format helpers used by Heartbeat entries
- Recreate as package Svelte components without Studio imports:
  - `runtime-stage-heartbeat.svelte` -> `HeartbeatView.svelte`
  - `runtime-heartbeat-group.svelte` -> `heartbeat-group.svelte`
  - `runtime-heartbeat-entry.svelte` -> `heartbeat-entry.svelte`
  - `runtime-heartbeat-part-content.svelte` -> `heartbeat-part-content.svelte`
  - `runtime-heartbeat-tool-block.svelte` -> `heartbeat-tool-block.svelte`
  - `runtime-heartbeat-statusbar.svelte` -> `heartbeat-statusbar.svelte`
  - `runtime-heartbeat-config-panel.svelte` -> package-local statusbar action surface
  - `runtime-heartbeat-status-context.svelte` and status shimmer -> package-local status readouts
- Leave behind in first apply:
  - Studio route/controller wiring
  - Studio runtime shell rebinding
  - Studio stories except as behavioral reference

## Existing Data Path To Use

- Studio Avatar route opens Heartbeat by `runtimeStore.createSession({ cwd, avatar, autoStart:false })`, then navigates to `/avatars/runtime/{session.id}/heartbeat`.
- `resolveAvatarRuntimeId(avatar)` derives deterministic UUID from normalized nickname.
- `resolveAvatarSessionId(avatar)` returns `resolveAvatarRuntimeId(avatar)`.
- session catalog `create(...)` creates/reuses a stopped session using that deterministic id.
- client-sdk `createSession(...)` calls existing `session.create`, then hydrates runtime state.
- client-sdk `loadHeartbeatGroups(sessionId)` and `loadMoreHeartbeatGroups(sessionId)` call existing `runtime.heartbeatGroupsPage({ sessionId })`.
- app-server `pageHeartbeatGroups(sessionId)` reads the session DB projection when session metadata exists; no Avatar-specific Heartbeat endpoint is required.

## External UI Reference

Context7 lookup for `/sikandarjodd/ai-elements` confirmed the relevant component families for this package: Conversation, Message, Reasoning, Tool, Context, Loader, and Actions. The reference is a component-pattern source, not a transport or truth-source law.

## Verification Evidence

- `bun run --filter '@agenter/web-heartbeat-view' typecheck`: passed with 0 errors and 0 warnings.
- `bun run --filter '@agenter/web-heartbeat-view' test`: passed with unit, Storybook browser, and DOM browser projects.
- `bun run --filter '@agenter/web-heartbeat-view-example' typecheck`: passed with 0 errors and 0 warnings.
- `bun run --filter '@agenter/web-heartbeat-view-example' test`: passed.
- Static scan found no `any`, `as any`, or `@ts-nocheck` under `packages/web-heartbeat-view`.
- Static scan found no backend or Studio code diff in `packages/app-server`, `packages/client-sdk`, or `apps/studio`.
- Route-level evidence is stored under `.screenshot/web-heartbeat-view/` for mobile and desktop directory/Heartbeat flows.
- The live acceptance URL for this apply round is `http://127.0.0.1:4180/?wsUrl=ws%3A%2F%2F127.0.0.1%3A4590%2Ftrpc`.
