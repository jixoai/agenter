## 1. Control-plane and runtime contracts

- [x] 1.1 Add terminal-system projections that expose focused terminal ids per actor seat and validate actor-scoped focus mutations, including token-bound seat authority.
- [x] 1.2 Refactor app-server runtime terminal projections so session snapshots publish the current session actor's focused terminal set without pretending that UI tab selection is the same thing.
- [x] 1.3 Refactor terminal source adapter ingestion so LoopBus only reads terminals focused by the current session actor.

## 2. WebUI terminal collaboration semantics

- [x] 2.1 Remove the global toolbar focus button from the terminal workbench and keep only local viewport or presentation controls there.
- [x] 2.2 Add focus and unfocus controls to each user seat in the terminal Users panel, executed with that seat's token.
- [x] 2.3 Make terminal selection a pure inspection concern that does not mutate terminal-system focus.

## 3. Verification

- [x] 3.1 Add control-plane and runtime tests for multi-actor focus, per-actor unfocus, and session-actor-only attention ingestion.
- [x] 3.2 Add Storybook DOM or browser-driven coverage for per-user focus controls and the absence of global focus mutation in toolbar chrome.
- [x] 3.3 Execute BDD verification slice `51-75`, `78`, `80-83`, `85`, `90-95`, `100`, marking each scenario as automated, manual, real, or skipped.
- [x] 3.4 Run targeted verification commands and record the command list in this file before implementation is declared complete.

### BDD verification slice status

- `51-65`: automated
- `66-75`: automated
- `78`: real cross-change dogfood executed through the shared WebUI harness; blocked by ISSUE-001 and ISSUE-003 in `.tmp/dogfood-vnext/report.md`, where the room/route collaboration path still fails before terminal follow-up can settle cleanly.
- `80-83`: real cross-change dogfood executed through the shared WebUI harness; terminal route loads, Access uses auth-backed actors, but ISSUE-002 shows the terminal surface leaking raw CSS into the primary content body.
- `85`: real cross-change dogfood executed through the shared WebUI harness; chat/terminal navigation and token-bound surfaces were exercised on desktop and mobile, with blocking route/render regressions captured in `.tmp/dogfood-vnext/report.md`.
- `90-95`: skipped, pending mixed real-AI collaboration verification environment
- `100`: real final cross-change dogfood sweep executed on desktop and `iPhone 14`; the sweep found blocking collaboration regressions and is recorded in `.tmp/dogfood-vnext/report.md`.
- `78`, `80-85`, `100` rerun: re-executed on `http://127.0.0.1:64411` in `MODEL_MODE=real`; terminal text/CSS no longer leaks into route body, and the `iPhone 14` navigation path from `Terminals` to `Chats` no longer leaves stale terminal content behind.

### Notes

- This change completed the terminal-seat focus, token-bound terminal action identity, and runtime attention ingestion coverage.
- Cross-system room/terminal dogfood scenarios were executed in the shared verification sweep; the remaining gaps are no longer “not run”, they are now concrete failures captured in `.tmp/dogfood-vnext/report.md`.

### Verification log

- `bun run typecheck`
- `bun test packages/terminal-system/test/control-plane.test.ts`
- `bun test packages/app-server/test/trpc-router.test.ts packages/app-server/test/session-runtime.attention-system.test.ts`
- `bun run --filter '@agenter/webui' test:unit -- global-collaboration-routes.test.tsx`
- `bun run --filter '@agenter/webui' test:dom -- test/storybook/global-terminal-workbench.stories.test.tsx`
- `bun run test -- terminal-view-element.test.ts` (cwd: `packages/terminal-view`)
- `bun --eval 'import { startE2EServerHarness } from "./packages/webui/test/e2e/server-harness"; const harness = await startE2EServerHarness(); console.log(\`BASE_URL=\${harness.baseUrl}\`); console.log(\`MODEL_MODE=\${harness.modelMode}\`); await new Promise(() => {});'`
- `agent-browser --session agenter-vnext-dogfood open http://127.0.0.1:59001`
- `agent-browser --session agenter-vnext-dogfood set device "iPhone 14"`
- `agent-browser --session agenter-vnext-desktop open http://127.0.0.1:64411/terminals`
- `agent-browser --session agenter-vnext-desktop set device "iPhone 14"`
- `agent-browser --session agenter-vnext-desktop navigate Terminals -> mobile drawer -> Chats; verified clean chat body without leaked terminal CSS/content`
- `dogfood evidence report: .tmp/dogfood-vnext/report.md`
