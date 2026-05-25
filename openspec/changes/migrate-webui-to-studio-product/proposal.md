## Why

`@agenter/webui` is still delivered by a core `agenter web` command that directly owns WebUI static assets and dev-server startup, while `agenter-ext-shell` already follows the product-extension law: descriptor lookup, local-first package resolution, launcher-owned daemon context, and product-owned UI lifecycle. This change removes that architectural split by turning the operator Web product into the `agenter-ext-studio` ecosystem package launched through `agenter studio`.

## What Changes

- Rename the active SvelteKit operator package from `@agenter/webui` / `packages/webui` to `agenter-ext-studio` / `packages/studio`. **BREAKING**
- Remove the built-in `agenter web` command and its core-owned WebUI static asset resolution/copy path; `web` becomes an unsupported command instead of a compatibility alias. **BREAKING**
- Add `studio` to the product command descriptor registry so `agenter studio` resolves `agenter-ext-studio` with the same local-first package law as `agenter shell`. **BREAKING**
- Move Studio serving, static asset resolution, and dev-server startup into the `agenter-ext-studio` package, using launcher-provided daemon/auth context instead of importing core runtime internals. **BREAKING**
- Rename the existing icon composer package from `@agenter/ui-studio` / `packages/ui-studio` to `@agenter/icon-studio` / `packages/icon-studio` so `studio` names the operator product unambiguously. **BREAKING**
- Rename product-owned durable keys, docs, package scripts, and active specs from `webui` to `studio` where they describe the active operator product. **BREAKING**

## Capabilities

### New Capabilities

- `studio-product`: defines the `agenter-ext-studio` product package, its CLI surface, daemon context contract, static/dev serving behavior, and its boundary from core runtime modules.
- `icon-studio`: defines the renamed icon composer package and its boundary from the operator Studio product.

### Modified Capabilities

- `product-command-launcher`: add `studio` as a descriptor-driven product command and remove `web` from built-in launcher ownership.
- `product-extension-runtime`: clarify that GUI products such as Studio consume the same generic product-extension contracts as terminal products without core imports.
- `svelte-webui-platform`: migrate the active SvelteKit operator platform identity from WebUI to Studio and remove CLI-owned delivery as the active law.
- `webui-storybook-static-build`: migrate Storybook/static-build requirements to `agenter-ext-studio`.
- `webui-entry-redirects`: migrate static entry and nested route fallback requirements to Studio-owned serving.

## Impact

- CLI launcher and tests: `packages/cli/src/product-command-registry.ts`, `packages/cli/src/product-command-launcher.ts`, `packages/cli/src/run-cli.ts`, `packages/cli/test/*`.
- Product packages: `packages/webui` becomes `packages/studio`; `packages/ui-studio` becomes `packages/icon-studio`.
- Build scripts and package metadata: root `package.json`, package scripts, icon scripts, asset docs, package imports.
- Durable specs: `SPEC.md`, `packages/cli/SPEC.md`, `packages/product-extension-runtime/SPEC.md`, the renamed package specs, and affected OpenSpec capability specs.
- Verification: BDD tests for descriptor routing and unsupported `web`, package typechecks, Studio build/test, icon-studio build/test, OpenSpec strict validation, and post-implementation merge verification.
