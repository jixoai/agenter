## Why

Avatar prompt/root resolution still carries an old workspace-local design in code, specs, SDK types, and tests. The durable Avatar topology now says the Avatar catalog is global and each Avatar's canonical private runtime home is `~/.agenter/avatars/by-principal/<principalId>`, but several implementation paths still allow `AGENTER.mdx` to be read from or seeded into `<workspace>/.agenter/avatars/by-principal/<principalId>`.

That mixes two different authorities: a workspace is a place where an Avatar works, while the Avatar prompt is part of the global Avatar definition. Letting a workspace own `AGENTER.mdx` can make the same Avatar become different across projects and keeps stale local `.agenter` residue operationally meaningful.

## What Changes

- Make `AGENTER.mdx` prompt source resolution global-only: `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`.
- Remove workspace-local prompt root precedence from session config and product prompt seed paths.
- Remove `workspacePath` from product prompt seed contracts so products cannot express a workspace-scoped prompt seed.
- Keep `Slot` semantics unchanged; it remains a syntax/composition tool and must not branch on `AGENTER.mdx`.
- Keep memory pack, skill workspace behavior, and workspace-private asset strategy out of this change except where tests need to prove they are not prompt authority.
- Audit the runtime identity path so prompt root uses the global Avatar principal, not an accidental workspace seat principal.
- Add a local cleanup task to organize this machine's `~/Dev/GitHub/jixoai-labs/agenter/.agenter` and `~/.agenter` directories after the prompt/root law is encoded, deleting or moving obsolete workspace prompt residue where safe.

## Capabilities

### Modified Capabilities

- `avatar-runtime-topology`: Clarify that Avatar-authored prompt root is only the global principal-address Avatar root, and workspace-local `AGENTER.mdx` files cannot shadow it.
- `product-extension-runtime`: Clarify product prompt seed APIs seed only the global Avatar prompt and do not accept workspace-scoped prompt roots.

## Impact

- OpenSpec truth:
  - `openspec/specs/avatar-runtime-topology/spec.md`
  - `openspec/specs/product-extension-runtime/spec.md`
  - `packages/app-server/SPEC.md`
  - `packages/product-extension-runtime/SPEC.md`
- Likely implementation areas:
  - `packages/app-server/src/session-config.ts`
  - `packages/app-server/src/app-kernel.ts`
  - `packages/product-extension-runtime/src/assistant-init.ts`
  - `packages/client-sdk/src/runtime-store.ts`
  - `packages/client-sdk/src/product-extension-runtime.ts`
  - `extensions/cli-shell/src/bootstrap.ts`
- Likely tests:
  - `packages/app-server/test/session-config.test.ts`
  - `packages/app-server/test/product-extension-runtime.test.ts`
  - `packages/app-server/test/app-kernel.test.ts`
  - `packages/app-server/test/prompt-store.test.ts`
  - `packages/client-sdk/test/product-extension-runtime.test.ts`
  - `extensions/cli-shell/test/fake-cli-shell-store.ts`
- Local operator cleanup scope:
  - `~/Dev/GitHub/jixoai-labs/agenter/.agenter`
  - `~/.agenter`
