## Context

The repository currently has two different product delivery laws:

1. `agenter shell` is a descriptor-driven product command. Core CLI resolves the controlled descriptor, ensures or reuses daemon/auth authority, injects explicit environment variables, and lets `agenter-ext-shell` own product grammar and UI lifecycle.
2. `agenter web` is a core built-in command. Core CLI imports WebUI static-root helpers, directly resolves `packages/webui/build`, starts the Vite dev server from `packages/webui`, and copies WebUI assets into CLI packaging.

The second law makes the Web operator surface look like a core subsystem even though it is product UI. The requested migration intentionally breaks compatibility: the active operator product becomes `agenter-ext-studio`, started by `agenter studio`; the old `web` command is removed; the existing `@agenter/ui-studio` icon composer is renamed to `@agenter/icon-studio` so names are unambiguous.

## Goals / Non-Goals

**Goals:**

- Make `studio` obey the same descriptor-driven product command law as `shell`.
- Move Studio product lifecycle, static serving, dev serving, and user-facing CLI grammar into `agenter-ext-studio`.
- Remove core CLI ownership of WebUI assets and the `web` built-in command.
- Preserve launcher-owned daemon/auth authority as the single runtime bootstrap law.
- Rename the old `ui-studio` icon composer to `icon-studio` without mixing it into the operator product.
- Migrate durable docs/specs/tests from WebUI naming to Studio naming where they describe the active product.

**Non-Goals:**

- Do not preserve `agenter web` as a deprecated alias.
- Do not keep `@agenter/webui` as an active package identity.
- Do not redesign the Studio UI/IA as part of this migration.
- Do not merge icon composer features into the operator Studio product.
- Do not add product-specific branches to `app-server`, `client-sdk`, terminal, message, avatar, or attention systems.

## Decisions

### 1. Studio is a product package, not a core web mode

`agenter studio` will be registered in `packages/cli/src/product-command-registry.ts` as descriptor data:

- `productId=studio`
- `command=studio`
- `packageName=agenter-ext-studio`
- `bin.name=agenter-studio`
- `bin.mainExport=runStudio`
- `requiresDaemon=true`

Core CLI remains responsible for descriptor lookup, package resolution, daemon/auth context, stdio/exit propagation, and local in-process execution for workspace products. It will not know Studio's dev/static flags, SvelteKit path, static root, Vite server, browser URL output, or UI storage keys.

Rejected alternative: keep `agenter web` as a core command that delegates internally to Studio.

Reason rejected: even a thin built-in alias keeps product lifecycle as a privileged core special case and preserves the old architecture under a new name.

### 2. `web` is removed, not deprecated

`web` is removed from the built-in command set. After migration, `agenter web` follows the same unsupported-command path as any unknown product command.

Rationale:

- the user explicitly requested a breaking update
- no alias means scripts fail loudly and migrate to `agenter studio`
- it prevents two public command names from describing the same product

### 3. Studio owns both static and dev serving

`agenter-ext-studio` will expose product CLI grammar such as:

- default/static mode: start or reuse daemon through launcher env, serve the built Studio build, and print a URL
- dev mode: start a Vite dev server from the Studio package, inject `PUBLIC_AGENTER_WS_URL` for the launcher-provided daemon, and print API/UI URLs

The exact flags can initially mirror the old `agenter web` flags (`--dev`, `--web-port`) to reduce implementation risk, but they now belong to Studio. Core CLI must not parse them.

Static asset helpers move from `packages/cli/src/webui-static-root.ts` to Studio-owned code with Studio naming. CLI packaging no longer copies Studio assets into `packages/cli/assets/webui`; published Studio package artifacts are the product package's concern.

### 4. `@agenter/ui-studio` becomes `@agenter/icon-studio`

The existing `packages/ui-studio` package is a specialized icon composer/tooling package. It becomes `packages/icon-studio` with package name `@agenter/icon-studio`.

Rationale:

- `studio` should name the operator product
- `icon-studio` accurately names the existing tool atom
- build scripts can continue to consume icon-studio exports without depending on the operator Studio route tree

### 5. Product storage keys migrate deliberately

Source code and tests that describe active product identity should move from `webui/*` or `agenter:webui:*` to `studio/*` or `agenter:studio:*`. Existing user-local persisted UI preferences may be reset by this breaking change. No migration shim is required.

Rationale:

- the change is explicitly breaking
- durable product identity should not keep obsolete namespace names
- adding compatibility reads would preserve an unnecessary second identity

### 6. Specs retain historical WebUI references only when naming archived/inactive things

Durable specs and package specs should use Studio for the active SvelteKit operator product. Historical references such as `@agenter/webui-bak` may remain only when explicitly describing the archived React reference package.

## Risks / Trade-offs

- [Large rename may cause stale imports or package filters] -> Use `git mv` for package directories, `rg` for all `webui/ui-studio` references, and focused package-manager checks.
- [SvelteKit generated directories or build artifacts pollute the change] -> Keep generated `.svelte-kit`, `build`, test-results, and temporary screenshots out of the intentional diff unless already tracked and required.
- [Core CLI tests still assume `agenter web`] -> Rewrite those tests as Studio product-launch tests and add an explicit unsupported `web` scenario.
- [Static Studio package serving needs a package-owned build] -> Keep the first implementation local-first and BDD-covered. For remote package use, the package bin owns its own asset resolution.
- [User preferences stored under old WebUI keys reset] -> Accept as part of the breaking migration; specs and release notes should mention no compatibility shim.

## Migration Plan

1. Write BDD tests that fail for:
   - `studio` descriptor resolution to `agenter-ext-studio`
   - `web` removed from built-ins
   - Studio product launch receives daemon env and owns old dev/static flags
   - package identity renames for Studio and icon-studio
2. Move `packages/webui` to `extensions/studio` and update package metadata, bin, exports, scripts, README, Svelte/Vite/Storybook/Playwright configs, and active product namespaces.
3. Move `packages/ui-studio` to `packages/icon-studio` and update package metadata, scripts, imports, docs, and root build commands.
4. Delete CLI WebUI static-root/copy ownership and the built-in `web` command.
5. Add the `studio` descriptor and implement `agenter-ext-studio` product runner.
6. Update durable specs and package specs.
7. Run OpenSpec validation, CLI/product targeted tests, Studio/icon-studio typecheck/build/tests, and merge verification before landing.

Rollback is intentionally a revert of this change. There is no runtime compatibility path from `web` to `studio`.

## Open Questions

- None currently. The user has already selected breaking removal of `agenter web` and `icon-studio` as the renamed icon composer package.
