## 1. Message-system read-state

- [x] 1.1 Add message-system storage and control-plane APIs for actor-scoped room read cursor and read timestamp mutation.
- [x] 1.2 Add room projections that expose aggregate read progress plus per-seat read state for roster and message UI.
- [x] 1.3 Add message-system tests for multi-seat read progression, unread seats, and credential-invalid seats.

## 2. Chat surface refactor

- [x] 2.1 Remove the primary "pending for attention" room affordance from group chat surfaces.
- [x] 2.2 Add a read-progress ring or equivalent compact read-state affordance with a roster disclosure showing who read, who did not, and when.
- [x] 2.3 Refactor room users panel to show read-state and credential status as first-class collaboration facts.

## 3. Runtime projection boundary

- [x] 3.1 Keep session unread navigation projection working without making it the durable owner of room read-state.
- [x] 3.2 Add app-server and client-sdk projection tests that verify room-local read-state and app-level unread badges can coexist without being conflated.

## 4. Verification

- [x] 4.1 Add Storybook DOM or browser-driven coverage for room read-ring disclosure and per-seat read-state rendering.
- [x] 4.2 Add targeted backend or integration tests for read cursor updates across auth actors and session actors.
- [x] 4.3 Execute BDD verification slice `21-50`, `76-79`, `81-89`, `96-100`, marking each scenario as automated, manual, real, or skipped.
- [x] 4.4 Run targeted verification commands and record the command list in this file before implementation is declared complete.

### BDD slice status

- `21-35`: automated via `packages/message-system/test/message-system.test.ts`, `packages/app-server/test/trpc-router.test.ts`, `packages/webui/test/global-collaboration-routes.test.tsx`, and room collaboration Storybook DOM coverage.
- `36-50`: automated via `packages/message-system/test/message-system.test.ts`, `packages/app-server/test/trpc-router.test.ts`, `packages/client-sdk/test/runtime-store.test.ts`, `packages/webui/test/message-channel-surface.test.tsx`, and room collaboration Storybook DOM coverage.
- `76-79`: automated via `packages/client-sdk/test/runtime-store.test.ts`, `packages/webui/test/global-collaboration-routes.test.tsx`, and shared room projection coverage in `packages/app-server/test/trpc-router.test.ts`.
- `81-89`: automated via `packages/webui/test/message-channel-surface.test.tsx`, `packages/webui/test/global-collaboration-routes.test.tsx`, and `packages/webui/test/storybook/room-collaboration-read-state.stories.test.tsx`.
- `96-100`: real cross-change dogfood executed with the shared WebUI harness in `MODEL_MODE=real`, on desktop and `iPhone 14`; the sweep failed with blocking issues captured in `.tmp/dogfood-vnext/report.md`, including room messages stuck in `Pending for attention` instead of settling into transcript/read-state.
- `96-100` rerun: re-executed on the shared WebUI harness in `MODEL_MODE=real` at `http://127.0.0.1:64411`; room send now lands directly in transcript/read-state, and the blocking chat regression no longer reproduces.

### Verification log

- `bun run typecheck`
- `bun test packages/message-system/test/message-system.test.ts`
- `bun test packages/app-server/test/trpc-router.test.ts`
- `bun test packages/client-sdk/test/runtime-store.test.ts`
- `bun run --filter '@agenter/webui' test:unit -- message-channel-surface.test.tsx global-collaboration-routes.test.tsx`
- `bun run --filter '@agenter/webui' test:dom -- room-collaboration-read-state.stories.test.tsx message-channel-surface.stories.test.tsx`
- `bun run test -- web-chat-view.test.tsx` (cwd: `packages/web-chat-view`)
- `bun --eval 'import { startE2EServerHarness } from "./packages/webui/test/e2e/server-harness"; const harness = await startE2EServerHarness(); console.log(\`BASE_URL=\${harness.baseUrl}\`); console.log(\`MODEL_MODE=\${harness.modelMode}\`); await new Promise(() => {});'`
- `agent-browser --session agenter-vnext-dogfood open http://127.0.0.1:59001`
- `agent-browser --session agenter-vnext-dogfood set device "iPhone 14"`
- `agent-browser --session agenter-vnext-desktop open http://127.0.0.1:64411`
- `agent-browser --session agenter-vnext-desktop fill/click/get-text on Chats using real-model harness; verified room message is visible immediately in transcript and no pending affordance reappears`
- `dogfood evidence report: .tmp/dogfood-vnext/report.md`
