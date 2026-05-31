## Why

The current `avatar` and profile-image behavior is fragmented across local persona directories, `app-server` glue, and a browser-side rasterization workaround. That model cannot support authenticated profile ownership, multi-identifier binding, gravatar fallback, or a canonical icon service that other subsystems can reuse.

We need a real `profile-service` now because the app is expanding from “nickname-based local avatars” into durable identity, metadata, and icon infrastructure. If we keep layering this into `app-server`, prompt-persona storage, identity auth, and media delivery will collapse into one coupled surface and become harder to evolve than the new service itself.

## What Changes

- Add a dedicated `profile-service` package that owns profile identity, identifier binding, avatar metadata, icon media delivery, and deterministic fallback rendering.
- Add a dedicated `profile-cli` package that targets an arbitrary profile-service endpoint for authentication, metadata updates, and avatar/icon management.
- Support one durable profile being bound to multiple authenticated identifiers, starting with email and wallet identifiers, while preserving string-based temporary identifiers for deterministic fallback-only reads.
- Add email OTP bootstrap, wallet challenge authentication, and minimal WebAuthn pages for passkey registration/authentication.
- **BREAKING** Move avatar and session icon authority out of `app-server` local storage glue and browser `OffscreenCanvas` rasterization. `app-server` becomes a compatibility adapter over profile-service instead of the canonical icon owner.
- **BREAKING** Extend the icon system from “session + avatar uploads with local fallback” to a shared icon platform with typed owners, stable fallback precedence, and backend rasterization via `resvg`.
- Migrate existing avatar/session consumers in `app-server`, `client-sdk`, and WebUI to read semantic icon URLs from profile-service-backed endpoints.

## Capabilities

### New Capabilities
- `profile-identity-control-plane`: canonical profiles, multi-identifier binding, and durable metadata reads/writes.
- `profile-auth-control-plane`: email OTP bootstrap, wallet challenge auth, WebAuthn registration/authentication, and scoped access-token issuance.
- `profile-service-child-runtime`: app-server-owned lifecycle, endpoint discovery, and compatibility adaptation for the profile-service child service.

### Modified Capabilities
- `profile-image-system`: icon ownership, fallback precedence, and deterministic rendering move behind profile-service and extend to all icon owners including sessions.
- `identity-media-assets`: session and avatar media remain semantically separated, but the backing authority becomes profile-service rather than app-server-local storage.
- `global-user-settings`: global settings manage durable profiles and bound identifiers instead of only local avatar catalog state.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`, current `packages/avatar`, and two new packages: `packages/profile-service` and `packages/profile-cli`.
- Affected APIs: avatar/session icon media endpoints, global settings profile APIs, new profile-service auth and metadata APIs, and app-server child-service integration.
- Affected dependencies: `hono`, `@duckdb/node-api`, `@simplewebauthn/server`, `@simplewebauthn/browser`, wallet-signature verification libraries, and a native `resvg` FFI bridge for Bun.
- Affected tests: profile-service integration tests, profile-cli command tests, app-server adapter regressions, and WebUI/profile-management DOM contracts.

## Delivery Order

1. Define the profile identity/auth/icon contracts and the child-service boundary.
2. Build profile-service with DuckDB-backed persistence, icon rendering, and auth flows.
3. Build profile-cli against the public profile-service contract.
4. Migrate app-server and current clients into compatibility adapters over profile-service.
5. Remove obsolete browser-side icon rasterization and local avatar-image authority.
