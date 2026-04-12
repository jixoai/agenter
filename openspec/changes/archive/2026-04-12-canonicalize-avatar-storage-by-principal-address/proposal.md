## Why

The backend still stores avatar roots by `nickname`, for example `~/.agenter/avatars/default` and `<workspace>/.agenter/avatars/helper`. That violates the platform identity law the user clarified during audit:

- the private key is the identity source,
- the derived principal address is the public identity id,
- folders are isolation roots and therefore must key off the principal address,
- `nickname` is only an application-layer alias / lookup surface.

Keeping durable avatar folders keyed by `nickname` makes identity mutable in the wrong place and blocks future alias reassignment. We need a breaking storage-law correction now.

## What Changes

- **BREAKING** Replace nickname-keyed avatar roots with principal-keyed canonical roots.
- Introduce `by-principal` canonical directories plus `by-nickname` symlink aliases for both global and workspace-private avatar storage.
- Rewire avatar path resolution, seat persistence, workspace avatar catalog listing, and asset-root publication to use the canonical principal-root law.
- Add regression coverage proving canonical roots are address-based and nicknames resolve through symlink aliases.

## Capabilities

### Modified Capabilities
- `workspace-avatar-management`: avatar storage roots and seat files now use principal-address canonical folders, with nickname symlink aliases as the discoverability layer.

## Impact

- Affected code: `packages/avatar`, `packages/app-server/src/avatar-seat-store.ts`, `packages/app-server/src/avatar-catalog.ts`, `packages/app-server/src/workspace-system/*`, related tests and durable specs.
- Affected APIs: published avatar asset roots and catalog paths now point at principal-keyed canonical roots.
- Affected operations: avatar seat initialization, workspace avatar catalog discovery, workspace asset-root inspection, and avatar prompt-root resolution.
