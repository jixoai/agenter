## Context

The current WebUI `JsonView` is not actually a WebUI component. `packages/webui/src/lib/components/web-components/json-viewer.svelte` only forwards props into `@agenter/web-components`, where `json-viewer-element.ts` renders its own shadow-private toolbar, menu, surface framing, and manual YAML/JSON token coloring. That architecture made the viewer easy to reuse across hosts, but it now conflicts with the app's design law:

- WebUI surfaces are expected to share shadcn-svelte primitives and the same toolbar/menu affordance system.
- Framing ownership must stay with the page or card surface instead of being hidden inside a shadow root.
- Structured inspection content is already converging on CodeMirror-backed rendering for consistency and future extensibility.

At the same time, multiple WebUI routes still import the existing `json-viewer.svelte` path, so the migration should preserve the caller contract while changing the implementation behind it.

## Goals / Non-Goals

**Goals:**

- Move structured viewer rendering ownership fully into `packages/webui`.
- Use the standard dropdown-menu primitives for the viewer mode menu.
- Render YAML, formatted JSON, and raw text through one read-only CodeMirror surface.
- Preserve the existing viewer contract: YAML-first default, per-view override, global default override, and the current import path used by runtime/tool surfaces.
- Keep the viewer stable under unrelated rerenders by updating the existing CodeMirror instance instead of remounting it.

**Non-Goals:**

- Rebuild every existing Lit web-component in `@agenter/web-components`.
- Migrate `tool-invocation-card` away from Lit in this change.
- Introduce editing, schema-aware forms, or new backend payload formats.
- Redesign the surrounding runtime or terminal surfaces beyond what is needed to host the new viewer cleanly.

## Decisions

### 1. WebUI replaces the Lit viewer at the wrapper boundary

Decision:
`packages/webui/src/lib/components/web-components/json-viewer.svelte` will stop forwarding into the Lit custom element and will instead render a WebUI-native Svelte implementation.

Rationale:
- This is the narrowest platform move that gives WebUI full styling and interaction ownership immediately.
- Existing call sites keep the same import path, which avoids a broad feature-level rename.
- The older Lit atom can remain available for other consumers until a separate shared-platform decision is made.

Alternative considered:
- Rewrite `@agenter/web-components` to host Svelte or reopen the Lit shadow DOM further.
  Rejected because it would either violate the package boundary or keep the same styling ownership problem.

### 2. Viewer chrome becomes a standard dropdown-menu + button surface

Decision:
The mode picker will use `packages/webui/src/lib/components/ui/dropdown-menu/*` plus the shared `Button` primitive.

Rationale:
- Menu sizing, focus handling, animation, and typography become consistent with the rest of the WebUI.
- The viewer no longer owns a one-off pseudo-menu implementation.
- It aligns with the user's explicit request to use standard shadcn-svelte menu primitives.

Alternative considered:
- Keep a custom inline popover/menu implementation inside the viewer.
  Rejected because it would reintroduce a private UI law just for this component.

### 3. Structured rendering converges on one read-only CodeMirror pipeline

Decision:
The new viewer will use one persistent `EditorView` with read-only configuration, line wrapping, and mode-dependent language extensions (`yaml`, `json`, or plain text).

Rationale:
- YAML, JSON, and raw text now share one rendering substrate instead of mixing manual HTML tokenization with ad hoc text blocks.
- CodeMirror makes future upgrades possible without another renderer migration.
- A single persistent editor instance is compatible with the existing performance law for heavy structured viewers.

Alternative considered:
- Use Shiki for highlighting.
  Rejected because the user explicitly prefers CodeMirror for consistency, and CodeMirror already exists in the repo.

### 4. Framing ownership stays outside the viewer

Decision:
The viewer provides a default surface tone, but its root classes remain mergeable so page-level callers own the final border/background/padding contract.

Rationale:
- The old shadow-root surface made caller framing classes ineffective.
- WebUI now follows the `single ownership of framing` rule documented in `DESIGN.md`.
- Runtime and tool surfaces can keep their current outer card law without reopening viewer internals.

Alternative considered:
- Recreate the old fixed viewer framing internally.
  Rejected because it would continue the redundant framing problem, only in Svelte instead of Lit.

## Risks / Trade-offs

- [CodeMirror is heavier than the previous manual renderer] → Keep one persistent read-only editor per mounted viewer and preserve stable instance updates instead of remounting on every prop change.
- [WebUI and `@agenter/web-components` may coexist with two viewer implementations during transition] → Preserve the same mode values and storage key so global mode behavior stays coherent across old and new viewers while both exist.
- [Browser-only rendering can fail in jsdom or unsupported environments] → Fall back to a plain `<pre>` surface when CodeMirror cannot initialize.
- [New language packages add frontend dependencies] → Scope the additions to `@agenter/webui` only and cover the new behavior through Storybook DOM tests.

## Migration Plan

1. Create the new structured viewer state/helpers inside `packages/webui`.
2. Replace the current wrapper implementation with the Svelte + dropdown-menu + CodeMirror viewer.
3. Keep all existing WebUI imports on the current `json-viewer.svelte` path so feature code does not need a broad rename.
4. Add Storybook DOM coverage for mode switching and rendered content plus unit coverage for mode resolution.
5. Run typecheck, targeted tests, and a browser verification pass on runtime/tool surfaces.

Rollback:
Revert the WebUI wrapper to the previous custom-element host and remove the newly added viewer helper files/dependencies.

## Open Questions

- None for this implementation pass. The larger question of whether `tool-invocation-card` should also migrate from Lit to WebUI-native Svelte remains a separate follow-up change.
