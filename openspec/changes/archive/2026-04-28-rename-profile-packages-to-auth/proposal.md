## Why

The auth/identity/media service already behaves as an auth-first authority, but its package, CLI, child-runtime, and compatibility specs still expose `profile-*` as the primary system name. This keeps callers anchored to a legacy identity model and makes future auth capabilities look like feature-specific profile glue instead of platform law.

## What Changes

- **BREAKING**: Promote `@agenter/auth-service` and `@agenter/auth-cli` as the canonical package identities for the auth/identity/icon authority.
- Keep `@agenter/profile-service` and `@agenter/profile-cli` only as compatibility aliases during migration, with explicit deprecation boundaries.
- Rename child-runtime configuration, bridge naming, default data paths, log labels, test names, and operator-facing docs from profile-first wording to auth-first wording where they express platform identity.
- Preserve semantic media owner vocabulary such as `profile` where it names a media owner type rather than the backend service package.
- Preserve existing auth identity, managed principal, icon fallback, JWT, and endpoint behavior while changing the public package/runtime names.

## Capabilities

### New Capabilities
- `auth-service-package-identity`: Defines canonical auth service and auth CLI package/runtime identity, plus legacy profile alias rules.

### Modified Capabilities
- `profile-identity-control-plane`: Reframes the identity control plane around the canonical auth service name while preserving profile owner semantics.
- `profile-auth-control-plane`: Reframes proof-bearing auth flow ownership around auth-service package identity.
- `profile-service-child-runtime`: Replaces compatibility-named child-runtime ownership with canonical auth-service ownership and explicit profile-service alias behavior.

## Impact

- Affected packages: `packages/profile-service`, `packages/profile-cli`, `packages/app-server`, workspace dependency metadata, tests, SPEC files, and OpenSpec specs.
- Affected public surfaces: package names, CLI binary names, import paths, app-server child-runtime configuration, discovered auth endpoint descriptors, operator help text, log labels, and default local data directories.
- Compatibility requirement: legacy `profile-*` imports/binaries/config keys may remain as transitional aliases, but new code must depend on canonical `auth-*` identities.
