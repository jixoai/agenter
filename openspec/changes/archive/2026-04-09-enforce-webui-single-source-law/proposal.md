## Why

The current `agenter web` delivery path violates the single-source-of-truth law for WebUI assets. Engineers can fix a regression in `@agenter/webui`, verify it in the fresh SvelteKit build, and still have the default CLI entry keep serving an older copied bundle from `packages/cli/assets/webui`.

That split-brain behavior turns real UI regressions into misleading runtime symptoms. In this investigation, the missing room recovery fix and missing attention search initially appeared to still be broken, but the actual issue was that the default CLI entry was serving a stale asset copy instead of the current WebUI build.

## What Changes

- **BREAKING** Replace the implicit dual-root WebUI delivery model with one canonical static asset root per `agenter web` process.
- Change CLI startup so it serves the canonical WebUI build output, instead of silently preferring a stale copied snapshot.
- Require `agenter web` to fail fast with a remediation hint when the canonical asset root is missing or invalid, rather than serving an older divergent asset tree.
- Re-scope any copied CLI web assets as packaging artifacts only, not as an independent runtime truth inside the workspace.
- Add verification coverage for default `agenter web` deep-link refresh against the canonical asset root.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `svelte-webui-platform`: CLI WebUI delivery changes from "serve copied static assets" to "serve one canonical static asset root and refuse stale split-brain delivery."

## Impact

- Affected code: `packages/cli`, `packages/webui`, and WebUI asset build/copy scripts.
- Affected UX: default `agenter web` startup, room deep-link refresh, and runtime attention/search regressions no longer depend on whether a second asset copy was manually refreshed.
- Affected tooling: `build:webui`, `build:ui`, and any release/publish flow that materializes CLI WebUI assets.
