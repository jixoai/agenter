## Why

Frontend validation surfaced one immediate runtime blocker and one deeper authority mismatch in the avatar platform:

- runtime launch still hard-fails when `~/.agenter/avatars/by-nickname/<nickname>` exists as a legacy directory instead of the newer symlink alias form
- the previous draft treated "create global avatar" as an app-server/avatar-catalog mutation, but the durable law is higher: Avatar identity belongs to AuthSystem, because Avatar is a keyed entity and should be minted there first

Current repository facts already point in that direction:

- `@agenter/profile-service` already owns managed principals plus public identity/icon projection
- `PrincipalKind` already includes `avatar`, `room`, and `terminal`
- current global avatar catalog is still nickname/filesystem-centric, so frontend does not yet have a stable identity-first contract
- current fallback icon rendering does not yet use avatar identity metadata such as `classify` to improve recognition

If we leave this as an app-server-local mutation, frontend will build against the wrong authority and we will keep leaking filesystem alias details into a feature that should be keyed by AuthSystem identity.

## What Changes

- Tolerate or auto-migrate legacy global avatar nickname paths before runtime/session creation so principal-keyed storage law does not block existing users.
- Define global avatar creation as AuthSystem-managed avatar principal creation, not as a filesystem-owned avatar-catalog mutation.
- Add public avatar metadata and catalog projection rules so frontend receives a durable avatar identity plus opaque icon projection instead of inferring truth from nickname paths.
- Update fallback avatar media rules so backend-generated default artwork uses the avatar address/principal as the deterministic seed, with optional `classify` metadata mapped to a canonical lucide-style foreground SVG icon.

## Capabilities

### Modified Capabilities

- `workspace-avatar-management`
- `profile-identity-control-plane`
- `identity-media-assets`

## Impact

- `packages/profile-service/src/types.ts`
- `packages/profile-service/src/store/profile-store.ts`
- `packages/profile-service/src/service/profile-service.ts`
- `packages/profile-service/src/render/fallback-icons.ts`
- `packages/profile-service/src/server/app.ts`
- `packages/app-server/src/profile-service-bridge.ts`
- `packages/app-server/src/avatar-catalog.ts`
- `packages/app-server/src/app-kernel.ts`
- `packages/app-server/src/trpc/router.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `openspec/specs/profile-identity-control-plane/spec.md`
- `openspec/specs/identity-media-assets/spec.md`
- `openspec/specs/workspace-avatar-management/spec.md`
