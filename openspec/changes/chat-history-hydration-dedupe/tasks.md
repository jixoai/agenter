## 1. Runtime store dedupe

- [x] 1.1 Collapse semantically identical runtime-snapshot and persisted-history chat rows in `packages/client-sdk/src/runtime-store.ts`
- [x] 1.2 Prefer persisted numeric-id chat records when both variants exist
- [x] 1.3 Add a regression test in `packages/client-sdk/test/runtime-store.test.ts`

## 2. Frontend verification alignment

- [x] 2.1 Update WebUI E2E assertions to match the current tab-based mobile shell in `packages/webui/test/e2e/app.spec.ts`
- [x] 2.2 Assert long-history attachments through the actual reverse-scroll path instead of assuming the oldest turn is initially visible

## 3. Verification

- [x] 3.1 Run `bun test packages/client-sdk/test/runtime-store.test.ts`
- [x] 3.2 Run `bun run --filter '@agenter/webui' e2e -- test/e2e/app.spec.ts`
- [x] 3.3 Run `bun run --filter '@agenter/webui' build`

## Verification Notes

- `bun test packages/client-sdk/test/runtime-store.test.ts`
- `bun run --filter '@agenter/webui' e2e -- test/e2e/app.spec.ts`
- `bun run --filter '@agenter/webui' build`
- Manual browser walkthrough:
  - desktop Chat + Devtools via `agent-browser`, screenshots at `/tmp/agenter-chat-desktop.png` and `/tmp/agenter-devtools-desktop.png`
  - mobile iPhone 14 Chat + Devtools via `agent-browser`, screenshot at `/tmp/agenter-mobile-devtools.png`
