## 1. Package Identity

- [x] 1.1 Move the current service implementation into `packages/auth-service` with package name `@agenter/auth-service`
- [x] 1.2 Move the current CLI implementation into `packages/auth-cli` with package name `@agenter/auth-cli` and canonical `auth-cli` binary
- [x] 1.3 Rebuild `packages/profile-service` and `packages/profile-cli` as thin compatibility aliases that delegate to the auth packages
- [x] 1.4 Update workspace metadata and lockfile so first-party product packages depend on `@agenter/auth-service`

## 2. Runtime and CLI Migration

- [x] 2.1 Rename app-server imports, bridge internals, child-runtime options, logs, and descriptor wording from profile-service to auth-service
- [x] 2.2 Preserve legacy `profileService` config and profile package imports as tested compatibility aliases
- [x] 2.3 Switch fresh default storage paths to auth-service naming while explicitly reusing legacy profile-service storage when it is the only existing store
- [x] 2.4 Rename CLI help, env vars, command entrypoints, and tests to auth-first wording while keeping `profile-cli` behavior as an alias

## 3. Specs and Documentation

- [x] 3.1 Update root and package `SPEC.md` files so auth-service is the canonical service atom and profile remains only a domain/media owner term
- [x] 3.2 Update app-server and service tests to assert auth package identity, profile alias delegation, and single writable storage authority
- [x] 3.3 Add or update BDD tests for `auth-cli doctor`, legacy `profile-cli doctor`, and token env alias behavior

## 4. Verification

- [x] 4.1 Run targeted typechecks for `@agenter/auth-service`, `@agenter/auth-cli`, profile alias packages, and `@agenter/app-server`
- [x] 4.2 Run targeted tests for auth service, auth CLI, profile compatibility aliases, and app-server auth bridge
- [x] 4.3 Run root `bun run typecheck` and relevant root test surface after excluding known bak/demo workspaces
