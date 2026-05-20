## 1. Spec And Baseline

- [x] 1.1 Record the breaking decisions in proposal, design, and delta specs: `agenter web` removed, `agenter studio` productized, `@agenter/webui` renamed to `@agenter/studio`, and `@agenter/ui-studio` renamed to `@agenter/icon-studio`.
- [x] 1.2 Run `openspec validate migrate-webui-to-studio-product --strict` before implementation.
- [x] 1.3 Add failing BDD coverage for Studio descriptor resolution, removed `web` command behavior, package identity renames, and product-owned Studio serving.

## 2. Product Launcher Law

- [x] 2.1 Add a `studio` product descriptor that resolves to `@agenter/studio` without importing Studio implementation code.
- [x] 2.2 Remove `web` from the core built-in command set and delete the built-in `agenter web` command path.
- [x] 2.3 Remove core WebUI static-root and asset-copy ownership from `@agenter/cli`.
- [x] 2.4 Update product launcher tests and CLI E2E tests so `agenter studio` is the product path and `agenter web` fails as unsupported.

## 3. Studio Package Migration

- [x] 3.1 Move `packages/webui` to `packages/studio` with package name `@agenter/studio`.
- [x] 3.2 Add the Studio product bin and `runStudio` entrypoint that consume launcher env and own static/dev serving.
- [x] 3.3 Rename active Studio source namespaces, storage keys, diagnostics, docs, scripts, test labels, and package filters from WebUI to Studio where they describe the active product.
- [x] 3.4 Keep Studio runtime access through daemon/client-sdk contracts and avoid app-server/core runtime imports in Studio startup.

## 4. Icon Studio Package Migration

- [x] 4.1 Move `packages/ui-studio` to `packages/icon-studio` with package name `@agenter/icon-studio`.
- [x] 4.2 Update icon-generation scripts, auth fallback imports, root scripts, docs, and package dependencies to use `@agenter/icon-studio`.
- [x] 4.3 Ensure Icon Studio remains separate from the operator Studio product and does not depend on Studio route internals.

## 5. Durable Specs And Docs

- [x] 5.1 Update `SPEC.md`, `packages/cli/SPEC.md`, `packages/product-extension-runtime/SPEC.md`, and package-level specs for Studio and Icon Studio.
- [x] 5.2 Update affected OpenSpec main specs after implementation so durable capability specs no longer describe active WebUI delivery through `agenter web`.
- [x] 5.3 Update README and asset documentation for `agenter studio`, `@agenter/studio`, and `@agenter/icon-studio`.

## 6. Verification

- [x] 6.1 Run targeted CLI/product launcher tests.
- [x] 6.2 Run Studio typecheck, unit tests, DOM tests where practical, and build.
- [x] 6.3 Run Icon Studio typecheck, tests, and build.
- [x] 6.4 Run `openspec validate migrate-webui-to-studio-product --strict`.
- [x] 6.5 Run `openspec validate --specs --strict`.
- [x] 6.6 Run `git diff --check`.
- [x] 6.7 Rebase the feature branch on the target ref, run merge simulation, land with the repository ff-only script, and clean the worktree after successful verification.
