## Why

`@agenter/webui` is still delivered by a core `agenter web` command that directly owns WebUI static assets and dev-server startup, while `agenter-app-shell` already follows the app-extension law: descriptor lookup, local-first package resolution, launcher-owned daemon context, and app-owned UI lifecycle. This change removes that architectural split by turning the operator Web app into the `agenter-app-studio` ecosystem package launched through `agenter studio`.

## What Changes

- Rename the active SvelteKit operator package from `@agenter/webui` / `packages/webui` to `agenter-app-studio` / `apps/studio`. **BREAKING**
- Remove the built-in `agenter web` command and its core-owned WebUI static asset resolution/copy path; `web` becomes an unsupported command instead of a compatibility alias. **BREAKING**
- Add `studio` to the app command descriptor registry so `agenter studio` resolves `agenter-app-studio` with the same local-first package law as `agenter shell`. **BREAKING**
- Move Studio serving, static asset resolution, and dev-server startup into the `agenter-app-studio` package, using launcher-provided daemon/auth context instead of importing core runtime internals. **BREAKING**
- Rename the existing icon composer package from `@agenter/ui-studio` / `packages/ui-studio` to `@agenter/icon-studio` / `packages/icon-studio` so `studio` names the operator app unambiguously. **BREAKING**
- Rename app-owned durable keys, docs, package scripts, and active specs from `webui` to `studio` where they describe the active operator app. **BREAKING**

## Capabilities

### New Capabilities

- `studio-app`: defines the `agenter-app-studio` app package, its CLI surface, daemon context contract, static/dev serving behavior, and its boundary from core runtime modules.
- `icon-studio`: defines the renamed icon composer package and its boundary from the operator Studio app.

### Modified Capabilities

- `app-command-launcher`: add `studio` as a descriptor-driven app command and remove `web` from built-in launcher ownership.
- `app-runtime`: clarify that GUI products such as Studio consume the same generic app-extension contracts as terminal products without core imports.
- `svelte-webui-platform`: migrate the active SvelteKit operator platform identity from WebUI to Studio and remove CLI-owned delivery as the active law.
- `webui-storybook-static-build`: migrate Storybook/static-build requirements to `agenter-app-studio`.
- `webui-entry-redirects`: migrate static entry and nested route fallback requirements to Studio-owned serving.

## Impact

- CLI launcher and tests: `packages/cli/src/app-command-registry.ts`, `packages/cli/src/app-command-launcher.ts`, `packages/cli/src/run-cli.ts`, `packages/cli/test/*`.
- App packages: `packages/webui` becomes `apps/studio`; `packages/ui-studio` becomes `packages/icon-studio`.
- Build scripts and package metadata: root `package.json`, package scripts, icon scripts, asset docs, package imports.
- Durable specs: `SPEC.md`, `packages/cli/SPEC.md`, `packages/app-runtime/SPEC.md`, the renamed package specs, and affected OpenSpec capability specs.
- Verification: BDD tests for descriptor routing and unsupported `web`, package typechecks, Studio build/test, icon-studio build/test, OpenSpec strict validation, and post-implementation merge verification.
