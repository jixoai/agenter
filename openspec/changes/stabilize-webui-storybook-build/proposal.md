## Why

`@agenter/webui` already uses Storybook DOM tests as the primary regression surface for complex Svelte interactions, but its static Storybook build regressed into a hard `SIGILL` crash under the current dependency lock. That leaves the package with a split toolchain where browser tests can pass while the official Storybook artifact pipeline is unusable.

## What Changes

- Stabilize the `@agenter/webui` Storybook dependency line so `pnpm --filter '@agenter/webui' storybook:build` succeeds on the same workbench and workspace stories used by DOM contract tests.
- Preserve the existing `@storybook/addon-svelte-csf` patch while upgrading the official Storybook packages to a compatible patch line.
- Capture a durable engineering contract that the WebUI Storybook DOM surface and the static Storybook build must stay green together.

## Capabilities

### New Capabilities

- `webui-storybook-static-build`: Defines the durable contract for keeping the Svelte WebUI Storybook toolchain statically buildable alongside Storybook DOM tests.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/webui/package.json`, workspace lockfile, Storybook build verification.
- Affected systems: WebUI tooling, Storybook DOM regression workflow, static Storybook artifact generation.
- Dependencies: `storybook`, `@storybook/sveltekit`, `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-vitest`.
