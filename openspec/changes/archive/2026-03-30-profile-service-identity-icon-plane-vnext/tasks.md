## 1. Service foundation

- [x] 1.1 Scaffold `packages/profile-service` with package exports, Hono server entry, shared types, and test harness
- [x] 1.2 Add runtime configuration for profile-service data root, endpoint, child-service lifecycle, and app-server adapter wiring
- [x] 1.3 Add DuckDB schema creation/migration helpers for profiles, identifiers, auth state, WebAuthn credentials, and icon assets

## 2. Icon engine and persistence

- [x] 2.1 Extract deterministic SVG icon generation into profile-service for both `profile` and `session` owners
- [x] 2.2 Add the native `resvg` FFI bridge and Bun bindings for SVG-to-PNG/JPEG rasterization
- [x] 2.3 Implement icon read/write APIs with owner-aware fallback precedence and blob-backed asset persistence

## 3. Identity and auth control plane

- [x] 3.1 Implement profile resolution, public projection, metadata mutation, and multi-identifier binding rules
- [x] 3.2 Implement email OTP bootstrap plus WebAuthn registration/authentication endpoints and minimal Svelte 5 pages
- [x] 3.3 Implement wallet challenge verification for EVM and Solana plus scoped auth-token issuance

## 4. CLI and app-server adaptation

- [x] 4.1 Scaffold `packages/profile-cli` with endpoint-oriented commands for auth, profile reads, metadata writes, and icon uploads
- [x] 4.2 Add app-server child-runtime startup and compatibility proxy routes for profile/session media and profile APIs
- [x] 4.3 Remove legacy browser-driven session icon rasterization and legacy local avatar image authority from app-server/WebUI flows

## 5. Client migration and verification

- [x] 5.1 Update client-sdk and WebUI/global settings flows to consume profile-service-backed profile and icon contracts
- [x] 5.2 Add BDD coverage for profile-service APIs, auth flows, CLI commands, and app-server adapter regressions
- [x] 5.3 Run `bun run typecheck` and targeted package tests, then sync durable specs touched by the migration

## Validation notes

- Targeted validations passed for the migrated packages and flows:
  - `export PATH="/Users/kzf/.bun/bin:$PATH" && /Users/kzf/.bun/bin/bun run typecheck`
  - `cargo build --release --manifest-path packages/profile-service/native/resvg_bridge/Cargo.toml`
  - `/Users/kzf/.bun/bin/bun x tsc --noEmit -p packages/profile-service/tsconfig.json`
  - `/Users/kzf/.bun/bin/bun test packages/profile-service/test/profile-service.test.ts`
  - `/Users/kzf/.bun/bin/bun x tsc --noEmit -p packages/profile-cli/tsconfig.json`
  - `/Users/kzf/.bun/bin/bun test packages/profile-cli/test/profile-cli.test.ts`
  - `/Users/kzf/.bun/bin/bun x tsc --noEmit -p packages/client-sdk/tsconfig.json`
  - `/Users/kzf/.bun/bin/bun test packages/client-sdk/test/runtime-store.test.ts`
  - `/Users/kzf/.bun/bin/bun test packages/cli/test/trpc-server.test.ts`
  - `/Users/kzf/.bun/bin/bun run test:unit -- -t "Given shell navigation When opening global settings"` in `packages/webui`
  - `/Users/kzf/.bun/bin/bun run test:dom -- test/storybook/global-settings-panel.stories.test.tsx` in `packages/webui`
