## 1. Root auth bootstrap

- [x] 1.1 Add profile-service / app-server bootstrap APIs for root-auth status plus explicit generate-or-reveal action.
- [x] 1.2 Ensure backend generation persists root key material only in profile-service-owned storage and returns the generated key to the caller only through the explicit bootstrap action.
- [x] 1.3 Add backend tests for fresh-start generation, existing-key reveal, invalid stored token recovery, and external-auth-service mode.

## 2. WebUI onboarding

- [x] 2.1 Add an app-level superadmin onboarding flow that blocks the primary workbench path when no valid auth session exists.
- [x] 2.2 Add the frontend button that calls the backend root-key generate-or-reveal action and fills the private-key input.
- [x] 2.3 Keep existing settings auth controls as a maintenance path after onboarding, not as the only discovery path.

## 3. Auth actor catalog

- [x] 3.1 Add client-sdk and app-server APIs for listing auth actor projections with labels, kinds, icon URLs, and public metadata.
- [x] 3.2 Refactor room and terminal user-facing actor pickers to consume auth actor projections instead of freeform durable participant fields.
- [x] 3.3 Refactor room and terminal user rows to render auth-backed labels and icons, while still distinguishing session actors from auth actors.

## 4. Verification

- [x] 4.1 Add unit and integration tests for bootstrap status, backend generation, actor catalog listing, and icon projection fallback.
- [x] 4.2 Add Storybook DOM or browser-driven coverage for onboarding import/generate flows and actor-backed picker rendering.
- [x] 4.3 Execute BDD verification slice `1-20`, `76-77`, `84-85`, `98-100`, marking each scenario as automated, manual, real, or skipped.
- [x] 4.4 Run targeted verification commands and record the command list in this file before implementation is declared complete.

### BDD slice status

- `1-10`: automated via `packages/profile-service/test/profile-service.test.ts`, `packages/app-server/test/profile-service-bridge.test.ts`, `packages/app-server/test/trpc-router.test.ts`, `packages/webui/test/app.test.tsx`, and onboarding Storybook DOM coverage.
- `11-20`: automated via `packages/app-server/test/trpc-router.test.ts`, `packages/client-sdk/test/runtime-store.test.ts`, `packages/webui/test/actor-directory.test.ts`, `packages/webui/test/global-collaboration-routes.test.tsx`, and metadata disclosure Storybook DOM coverage.
- `76-77`: automated via shared auth actor projection coverage in `packages/webui/test/global-collaboration-routes.test.tsx`.
- `84-85`: automated via shared auth-backed room picker and roster coverage in `packages/webui/src/features/chat/message-channel-metadata-disclosure.stories.tsx` and `packages/webui/test/storybook/message-channel-metadata-disclosure.stories.test.tsx`.
- `98-100`: real cross-change dogfood executed with the shared WebUI e2e harness plus `agent-browser` on desktop and `iPhone 14`; the sweep surfaced blocking issues recorded in `.tmp/dogfood-vnext/report.md` (room messages stuck queued, terminal surface leaking raw CSS, and stale mobile route body after navigation).

### Verification log

- `bun test packages/profile-service/test/profile-service.test.ts`
- `bun test packages/app-server/test/profile-service-bridge.test.ts packages/app-server/test/trpc-router.test.ts`
- `bun test packages/client-sdk/test/runtime-store.test.ts`
- `bun run --filter '@agenter/webui' test:unit -- app.test.tsx runtime-selector.test.tsx global-collaboration-routes.test.tsx message-channel-surface.test.tsx actor-directory.test.ts`
- `bun run --filter '@agenter/webui' test:dom -- test/storybook/message-channel-metadata-disclosure.stories.test.tsx test/storybook/superadmin-onboarding-dialog.stories.test.tsx`
- `bun run typecheck`
- `bun --eval 'import { startE2EServerHarness } from "./packages/webui/test/e2e/server-harness"; const harness = await startE2EServerHarness(); console.log(\`BASE_URL=\${harness.baseUrl}\`); console.log(\`MODEL_MODE=\${harness.modelMode}\`); await new Promise(() => {});'`
- `agent-browser --session agenter-vnext-dogfood open http://127.0.0.1:59001`
- `agent-browser --session agenter-vnext-dogfood set device "iPhone 14"`
- `dogfood evidence report: .tmp/dogfood-vnext/report.md`
