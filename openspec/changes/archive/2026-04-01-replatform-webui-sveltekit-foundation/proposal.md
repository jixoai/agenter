## Why

The current WebUI is a React/Vite application that accumulated session-centric routing, custom UI primitives, and scroll/layout rules that no longer match the app's system-first direction. We need a breaking replatform so the frontend obeys the same platform laws as the backend: orthogonal systems, static delivery, and durable contracts instead of patchwork feature wiring.

## What Changes

- **BREAKING** rename the current React package to `webui-bak` and remove it from the active delivery path.
- **BREAKING** create a new `@agenter/webui` package based on SvelteKit 2, Svelte 5, and shadcn-svelte.
- Keep production delivery as a static frontend served by CLI assets, but upgrade the static serving contract to support SvelteKit SPA fallback output.
- Replace the old session-first route tree with a system-first route shell for workspaces, message-system, terminal-system, and global settings/profile management.
- Reuse the existing `@agenter/client-sdk` transport/runtime store instead of reimplementing backend protocols in the new UI.

## Capabilities

### New Capabilities
- `svelte-webui-platform`: Define the new SvelteKit-based WebUI package, static delivery contract, and system-first shell composition.

### Modified Capabilities
None.

## Impact

- Affected packages: `@agenter/webui`, `@agenter/cli`, `@agenter/client-sdk`
- Affected delivery contracts: CLI static asset copy/serve path, dev server environment injection, SPA fallback handling
- Affected documentation: `AGENTS.md`, `TESTING.md`, `SPEC.md`, package-level specs synced after implementation
