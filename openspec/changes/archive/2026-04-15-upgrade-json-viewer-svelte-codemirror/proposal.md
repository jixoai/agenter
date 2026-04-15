## Why

The current `YamlPreview / JsonView` surface in WebUI is still a Lit custom element wrapped by a thin Svelte host. That splits visual ownership across shadow DOM and route-level Tailwind surfaces, so menu chrome, spacing, framing, and typography cannot converge with the rest of the shadcn-svelte workbench.

We need to replace that now because structured payload inspection has become a first-class operator workflow inside Heartbeat, tool payloads, and cycle inspection. As long as the viewer remains a shadow-private Lit atom, WebUI cannot apply the same menu primitives, framing law, and CodeMirror-based rendering strategy used by the rest of the product.

## What Changes

- **BREAKING** Replace the WebUI `JsonView / YamlPreview` implementation with a WebUI-native Svelte structured viewer instead of the current Lit custom-element host wrapper.
- Rebuild the viewer mode menu with the standard shadcn-svelte dropdown-menu primitives while preserving both local-view and global-default mode controls.
- Render YAML, formatted JSON, and raw text through a read-only CodeMirror surface so structured previews use one editor-grade rendering pipeline.
- Keep existing runtime, tool, and cycle inspector call sites on the same import path while moving their rendering ownership fully into `packages/webui`.
- Add WebUI regression coverage for the structured viewer's menu behavior and read-only CodeMirror rendering.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `structured-value-preview`: structured preview rows now use a WebUI-native Svelte surface with CodeMirror-backed rendering instead of the prior lightweight Lit renderer, while keeping YAML-first defaults and local/global mode controls.

## Impact

- Affected code is concentrated in `packages/webui`, especially the existing `json-viewer.svelte` wrapper, runtime inspection surfaces, tool payload views, stories, and tests.
- `packages/webui` gains direct structured-viewer dependencies for YAML serialization and CodeMirror language extensions.
- No backend, transport, or durable storage contracts change; this is a presentation-layer and frontend-platform migration.
