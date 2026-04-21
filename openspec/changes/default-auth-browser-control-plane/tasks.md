## 1. Server-side auth law

- [x] 1.1 Refactor browser-facing app-server router procedures into explicit `public/auth/superadmin` classes and apply the new authorization matrix.
- [x] 1.2 Add daemon-mediated auto-login and local key-bootstrap APIs, and remove browser-facing raw managed-root-key reveal from the normal auth contract.
- [x] 1.3 Tighten CLI direct HTTP upload/media routes plus browser CORS/origin handling to enforce the new browser auth law.

## 2. Client and WebUI bootstrap

- [x] 2.1 Update client-sdk auth helpers for auto login, daemon-managed key storage, bearer-aware uploads, and authenticated media URL resolution.
- [x] 2.2 Refactor the WebUI app controller into an explicit auth-bootstrap state machine that gates protected hydration until authentication succeeds.
- [x] 2.3 Replace browser raw-key reveal flows in onboarding/admin surfaces with manual login plus daemon-managed auto-login bootstrap actions.

## 3. Verification and residue cleanup

- [x] 3.1 Add or update app-server and CLI-server tests for anonymous denial, superadmin control-plane access, auto login, media auth, and CORS/origin restrictions.
- [x] 3.2 Add or update client-sdk and WebUI tests for auth bootstrap state transitions, login gating, and authenticated media transport behavior.
- [x] 3.3 Run targeted verification, scan for legacy code residue from the old browser bootstrap flow, and record the command log here.

### Command Log

- `bun test packages/app-server/test/trpc-router.test.ts` -> pass (`18 pass`)
- `bun test packages/cli/test/trpc-server.test.ts` -> pass (`8 pass`)
- `bun test packages/client-sdk/test/runtime-store.test.ts` -> pass (`61 pass`)
- `pnpm --filter @agenter/webui exec vitest run --project server src/lib/app/app-auth-bootstrap-contract.spec.ts` -> pass (`2 pass`)
- `pnpm --filter @agenter/webui test:unit -- src/lib/app/app-auth-bootstrap-contract.spec.ts` -> fail because unrelated existing `src/lib/scroll-contract.spec.ts` reports `min-h-0` violations in dirty WebUI worktree
- `rg -n "bootstrapManagedKey|revealManagedRootAuthPrivateKey|revealManagedRootKey" packages openspec -S` -> no matches
- `rg -n "auth\\.bootstrapManagedKey|revealManagedRootAuthPrivateKey|revealManagedRootKey|bootstrap managed key|raw managed root key" packages openspec -S` -> no matches
