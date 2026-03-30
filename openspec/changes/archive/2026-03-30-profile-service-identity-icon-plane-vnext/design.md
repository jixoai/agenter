## Context

The repository currently treats `@agenter/avatar` as a nickname-scoped persona filesystem helper, while `app-server` owns avatar/session icon uploads and deterministic SVG fallback generation. WebUI adds a browser-only `OffscreenCanvas` rasterization step for session icons, which proves the fallback artwork is useful but also shows the current contract is upside-down: clients are compensating for backend media authority instead of consuming a stable media service.

The new product target is broader than “avatar uploads.” We need one service that can:
- own durable profile identity and metadata,
- bind multiple authenticated identifiers to one profile,
- expose session/profile icon media through one coherent icon platform,
- support gravatar as an external fallback source,
- and remain reusable as a child service under `app-server`.

This is a cross-cutting change touching new packages, auth flows, persistence, media delivery, and app-server adaptation. It also introduces new dependencies (`DuckDB`, `WebAuthn`, wallet verification, `resvg`) and requires separating identity storage from prompt-persona storage.

## Goals / Non-Goals

**Goals:**
- Introduce a dedicated `profile-service` package as the canonical owner of profile identity, metadata, auth, and icon delivery.
- Introduce a `profile-cli` package that can operate against any profile-service endpoint.
- Support one durable profile being bound to multiple authenticated identifiers.
- Keep temporary string identifiers as fallback-only virtual identities for deterministic icon reads.
- Move session icon and avatar/profile icon rendering behind the backend, including `resvg`-based rasterization.
- Preserve semantic URL separation between session icon media and profile/avatar icon media.
- Let `app-server` start and adapt a profile-service child runtime instead of remaining the canonical icon authority.

**Non-Goals:**
- Replace the existing `@agenter/avatar` persona prompt-layer with profile-service storage.
- Support every wallet ecosystem in the first slice; this design targets EVM and Solana first while leaving verifier registration extensible.
- Build a full browser-based admin panel; only minimal Svelte 5 pages for WebAuthn flows are in scope.
- Introduce cross-host federation or multi-tenant remote orchestration.

## Decisions

### `@agenter/avatar` remains a prompt-persona atom, not profile identity
The existing `@agenter/avatar` package keeps owning local persona prompt files and settings-layer resolution. The new `profile-service` owns durable user/profile identity and icon media.

Why: prompt/persona composition and identity ownership are different system laws. Merging them would couple prompt docs, auth, and media persistence into the same filesystem abstraction.

Alternative considered: fold profile-service into `@agenter/avatar` and extend local avatar folders with auth/media metadata. Rejected because it would keep durable identity anchored to workspace/home prompt directories and block service reuse.

### Profile identity is a `profile` plus typed `identifier` bindings
`profile-service` stores a canonical `profile` record and a separate `profile_identifier` table. Supported identifier families in V1 are:
- `email`
- `wallet_evm`
- `wallet_solana`
- `temp` (virtual only, not durable)

A durable profile can own multiple authenticated identifiers. Temporary identifiers are resolved on demand for deterministic fallback reads but are not persisted as durable bindings unless later claimed through an authenticated flow.

Why: this keeps “one person, many proofs” as a first-class law while avoiding a fake account system for arbitrary strings.

Alternative considered: one identifier equals one profile forever. Rejected because the user explicitly wants multi-identifier binding and later reconciliation would become a destructive migration.

### Icon ownership is typed and semantically separated
`profile-service` becomes a shared icon platform with typed owners:
- `profile`
- `session`

Public URLs remain semantically separated (`/media/profiles/...`, `/media/sessions/...` or app-server-compatible adapter aliases), but storage, fallback orchestration, and rasterization are owned by the same service.

Why: this allows one rendering/storage engine to serve all icons without collapsing session identity and user identity into one ambiguous namespace.

Alternative considered: make profile-service only handle profile avatars and leave session icons in app-server. Rejected because the user explicitly wants one icon service for all icons.

### Fallback precedence is deterministic and owner-aware
For profile icons the precedence is:
1. uploaded asset
2. gravatar result (only for email-backed resolution or explicit email lookup)
3. built-in deterministic renderer seeded by the resolved identity

For session icons the precedence is:
1. uploaded asset
2. built-in deterministic renderer seeded by workspace identity and session id

Why: fallback needs one declarative rule-set, not call-site-specific branching.

Alternative considered: let clients decide between gravatar and local fallback. Rejected because it would reintroduce client glue and inconsistent cache behavior.

### DuckDB is the durable fact store, including asset blobs
`profile-service` stores durable facts in DuckDB tables and keeps uploaded icon bytes in blob columns rather than sidecar filesystem paths. The first schema includes:
- `profile`
- `profile_identifier`
- `profile_auth_token`
- `email_challenge`
- `wallet_challenge`
- `webauthn_credential`
- `icon_asset`

Metadata fields that need flexibility (nickname, phones, addresses, extra labels) are stored in JSON columns, with stable lookup columns for unique identifiers and ownership.

Why: DuckDB remains the requested system of record, and blob storage keeps the first slice deployable as one service root without split-brain file handling.

Alternative considered: DuckDB for metadata plus filesystem for uploaded images. Rejected because it complicates portability and backups before scale demands it.

### Backend rasterization is implemented through a small Rust `resvg` bridge loaded by `bun:ffi`
`profile-service` ships a small native bridge exposing a C ABI to Bun. The bridge accepts SVG bytes plus output format/size and returns PNG or JPEG bytes. Bun loads that shared library through `bun:ffi` and uses it for raster variants and compatibility endpoints.

Why: the user explicitly wants `bun:ffi` with `resvg`; a tiny C ABI bridge is the safest boundary because Bun FFI targets C-style symbols while `resvg` itself is a Rust crate.

Alternative considered: use `@resvg/resvg-js` or keep browser `OffscreenCanvas` rasterization. Rejected because both bypass the requested Bun FFI architecture.

### Email auth is OTP bootstrap plus WebAuthn, wallet auth is challenge-signature based
Email flow:
1. request OTP
2. service prints/logs the code at the endpoint in V1
3. verify OTP and mint a short-lived registration ticket
4. complete WebAuthn registration/authentication on minimal Svelte 5 pages
5. exchange for profile auth token

Wallet flow:
1. request wallet challenge
2. sign challenge in CLI or compatible wallet flow
3. verify signature server-side
4. mint profile auth token and optionally create/bind profile

Why: email alone should not be treated as a durable long-term bearer in this product; passkeys provide the durable ownership proof, while wallets already provide cryptographic proof.

Alternative considered: email OTP alone creates durable sessions. Rejected because the user explicitly asked to start WebAuthn registration after email verification.

### App-server becomes a compatibility adapter over the child service
`app-server` starts `profile-service` as a child runtime unless an external endpoint is configured. Existing app-server-facing consumers keep using semantic avatar/session URLs and simple client-sdk helpers, but those methods become thin proxies/adapters over the profile-service contract.

Why: this preserves product ergonomics while moving real authority to the new service.

Alternative considered: migrate every consumer directly to a second endpoint immediately. Rejected because it would create needless churn across WebUI/client-sdk at the same time as the backend rewrite.

## Risks / Trade-offs

- [Auth surface growth] → Keep V1 to email + WebAuthn and wallet challenge flows; defer richer account recovery and admin tools.
- [Native bridge complexity] → Keep the Rust bridge tiny, expose only render/free functions, and cover it with contract tests from Bun.
- [DuckDB write concurrency] → Run profile-service as the single writer and keep app-server as a client/adapter, not a second writer.
- [Migration overlap with existing avatar persona folders] → Keep `@agenter/avatar` untouched for prompt loading and only migrate icon/profile authority.
- [Wallet ecosystem spread] → Ship verifier registration with EVM + Solana first and make additional verifier families additive.

## Migration Plan

1. Add OpenSpec contracts for profile identity/auth/child-runtime plus modified icon/global-settings requirements.
2. Introduce `packages/profile-service` with DuckDB schema, Hono APIs, auth flows, icon rendering, and minimal Svelte 5 WebAuthn pages.
3. Introduce `packages/profile-cli` for endpoint-oriented auth, upload, and metadata management.
4. Add an app-server profile-service child runtime and compatibility proxy methods for current clients.
5. Migrate client-sdk and WebUI to the new proxy-backed contract, then remove browser-side session icon rasterization.
6. Keep rollback at the adapter boundary: app-server can temporarily fall back to legacy icon behavior until all migrations pass.

## Open Questions

- V1 will implement EVM and Solana wallet verification first; additional wallet families remain open for later additive changes.
- Public profile discovery beyond icon/media projection is intentionally conservative in V1 and can expand after auth and identifier linking stabilize.
