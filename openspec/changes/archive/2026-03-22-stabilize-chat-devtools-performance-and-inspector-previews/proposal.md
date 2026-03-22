## Why

Chat and Devtools both regress under long histories because route-level subscriptions and unstable row/view-model identities keep recreating heavy read-only `CodeMirror` surfaces. Devtools also lacks the intended four-state loading contract and still dumps large structured facts as raw JSON-like Markdown instead of compact YAML-first previews.

## What Changes

- Narrow WebUI subscriptions so Chat and Devtools only observe the runtime slices needed by the active surface or active Devtools tab.
- Stabilize Chat row projection and row component identities so unchanged transcript rows do not remount read-only `CodeMirror` instances during unrelated runtime updates.
- Add a lightweight structured `JSONViewer` with `highlight-yaml`, `fmt-highlight-json`, and `raw-text-json` modes, plus menu-only local/global mode controls.
- Use the new structured viewer in Cycle facts and other structured inspection content instead of `MarkdownDocument`.
- Extend `AsyncSurface` so empty-loading can show an explicit loading hint while ready-loading keeps a restrained overlay.
- Add regression coverage for inactive-tab subscription isolation, chat row stability, async-surface four-state rendering, and YAML-first cycle fact previews.

## Capabilities

### New Capabilities
- `structured-value-preview`: Lightweight YAML-first structured previews for Devtools-style inspection content with menu-scoped render-mode controls.

### Modified Capabilities
- `webui-render-performance-guard`: Route surfaces now guard against unnecessary row/view-model churn in Chat and Devtools, not only shell callback churn.
- `workspace-devtools-surface`: Devtools panels now lazy-subscribe by active tab and render structured facts through dedicated viewers instead of Markdown dumps.
- `async-surface-states`: Empty-loading surfaces now expose explicit loading copy while populated surfaces keep restrained overlays.
- `runtime-ui-publication`: Active routes and tabs now subscribe to narrower runtime slices so unrelated hot updates do not republish heavy React-facing values.

## Impact

- Affected code: `packages/webui/src/router.tsx`, `packages/webui/src/features/chat/*`, `packages/webui/src/features/process/*`, `packages/webui/src/components/ui/async-surface.tsx`, new lightweight structured-viewer components, and targeted tests.
- Affected systems: browser render stability, Devtools inspection readability, Storybook DOM contracts, and runtime selector usage.
- No API contract changes outside WebUI/client selector usage.
