## Context

The current implementation already treats the service as the proof-bearing auth authority:

- `packages/profile-service/SPEC.md` says the compatibility package name remains, while durable semantics are auth / identity / icon service.
- `app-server` already exposes `AuthServiceBridge`, but it is an alias over `ProfileServiceBridge` and still imports `@agenter/profile-service`.
- Operator surfaces still expose `profile-cli`, `profile-service`, `PROFILE_SERVICE_TOKEN`, `profileService` options, and `.agenter/profile-service` storage as primary names.

This is a naming-law mismatch rather than a feature gap. The platform law should name the atom by what it owns: auth authority, principal identity, claims, and typed identity media. `profile` remains a domain concept only where the media owner is literally a user/profile identity.

## Goals / Non-Goals

**Goals:**

- Make `@agenter/auth-service` and `@agenter/auth-cli` the canonical packages.
- Keep `@agenter/profile-service`, `@agenter/profile-cli`, and `profile-cli` only as compatibility aliases.
- Rename app-server bridge/config/defaults from profile-first to auth-first where they describe the service atom.
- Preserve existing auth identity, managed principal, JWT, icon fallback, and endpoint behavior.
- Preserve `profile` as a typed media owner and command noun where it identifies user/profile data.

**Non-Goals:**

- Do not redesign auth protocols, JWT claims, managed principal records, or icon storage schemas.
- Do not remove legacy profile aliases in the same slice.
- Do not move Avatar prompt/persona ownership into the auth service.
- Do not rename the `profile` media owner type into `auth`; a profile icon is still a profile icon.

## Decisions

### 1. Canonical implementation moves to auth packages

The primary implementation should live under `packages/auth-service` and `packages/auth-cli`, with package names `@agenter/auth-service` and `@agenter/auth-cli`.

Alternative considered: keep folders named `profile-*` and only add auth-named exports. Rejected because it preserves the wrong atom boundary in workspace metadata, dependency graphs, generated lockfiles, and operator discovery.

### 2. Legacy profile packages become thin compatibility aliases

`packages/profile-service` and `packages/profile-cli` should remain as small wrappers that re-export or delegate to the auth packages. New app code must import auth packages; profile packages exist only to keep older scripts/tests/users from failing during the migration window.

Alternative considered: do a hard rename with no compatibility packages. Rejected for this slice because app-server, tests, docs, and local operator habits still reference `profile-*`; a thin alias lets the canonical law change without coupling it to every cleanup at once.

### 3. Runtime paths use auth-first defaults with explicit legacy fallback

New defaults should write under `.agenter/auth-service` and create/read `auth-service.duckdb`. If an existing `.agenter/profile-service` directory is present and no auth-service directory exists, the resolver may use the legacy directory as a compatibility fallback. The fallback must be explicit and logged; it must not create two writable stores.

Alternative considered: silently keep the old path. Rejected because storage paths are durable identity signals and would keep the platform physically named after the old atom.

### 4. External protocol nouns stay semantic

Routes and commands for user profile data can keep `profile` where the object is a profile projection. Package names, service logs, descriptor fields, env vars, and child-runtime options should say `auth`.

Alternative considered: rename every `profile` token. Rejected because it would conflate service identity with profile media owner identity and break the typed owner law.

## Risks / Trade-offs

- [Alias packages drift into second implementations] -> Keep compatibility packages as wrappers only, with tests that assert they delegate to auth packages.
- [Storage migration accidentally creates two authorities] -> Resolve data dir through one function and cover legacy fallback in an integration test.
- [Import migration is noisy] -> Migrate app imports first, keep old import tests only in compatibility packages.
- [Operator scripts break] -> Keep `profile-cli` as an alias binary and add `auth-cli` as the canonical binary.
- [Spec vocabulary becomes mixed] -> Update durable `SPEC.md` files and OpenSpec specs in the implementation commit, separating auth service identity from profile media owner semantics.

## Migration Plan

1. Create auth package directories by moving the current implementation from `profile-service` and `profile-cli`.
2. Add profile compatibility packages that depend on and re-export/delegate to auth packages.
3. Migrate app-server imports, bridge implementation names, config fields, default data dir, and tests to auth-first naming.
4. Keep deprecated profile config fields and binaries as aliases with tests.
5. Update durable specs and package SPEC files.
6. Run package-targeted tests, root typecheck, and root test surface relevant to auth/app-server.

Rollback: because profile packages remain as wrappers, rollback is primarily dependency metadata and import reversal. Data rollback must avoid moving or deleting user stores automatically; the resolver fallback keeps legacy stores readable.

## Open Questions

- Should the compatibility profile packages remain indefinitely or be scheduled for removal in a later change?
- Should profile-service data be physically migrated to auth-service, or should the first auth release only read legacy data in place when discovered?
