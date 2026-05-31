## Context

The current cli-shell projection law already keeps backend screen truth in the backend and uses `LiveTerminalMirror.followCursor()` after successful shell input. Double-click word selection and triple-click row selection live in `BackendFrameRenderable`, using `Intl.Segmenter` and terminal cell-width mapping.

The new failures are adjacent but should not become one-off key patches:

- Home/End and other terminal keys need a tested encoding matrix.
- Input and navigation keys must request cursor follow when backend input succeeds.
- Option+Left/Right should reuse the same word-boundary logic as double-click selection.
- Backends differ: xterm/headless may need more frontend enhancement while ghostty-native may own more behavior natively.

## Goals / Non-Goals

**Goals:**

- Make shell navigation return to the backend cursor for printable text, arrows, Home, End, and supported navigation keys.
- Extract terminal word-boundary logic into a pure reusable helper.
- Add a cli-shell interaction capability profile that enables enhancements only when backend recommendations say they are missing.
- Cover the supported key matrix with BDD tests.

**Non-Goals:**

- Do not move cli-shell app behavior into core terminal-system.
- Do not invent semantics for Option+Up/Down; pass them through to the backend/native terminal layer.
- Do not replace backend viewport truth with a local viewport override.
- Do not run native Ghostty/Cmux automation; native acceptance remains manual.

## Decisions

### Interaction enhancements are feature flags, not hardwired behavior

cli-shell will model enhancements such as `semanticWordSelection`, `semanticRowSelection`, `wordNavigation`, `followCursorOnInput`, and `homeEndFallback`. These flags are app-level policy consumed by the offscreen renderer/input bridge.

Alternative rejected: always enabling all enhancements. That would override capable engines and recreate backend-specific special cases in rendering code.

### Backend recommendations are generated and static for the MVP

A focused test will encode the current recommended defaults for supported backends. App runtime reads the recommendation map and enables only missing capabilities. This keeps startup simple and reproducible.

Alternative rejected: probing on every startup. That would add timing and lifecycle complexity to the already sensitive terminal startup path.

### Word navigation and word selection share one pure helper

The helper owns:

- ICU word segmentation through `Intl.Segmenter(undefined, { granularity: "word" })`.
- string-index to terminal-column mapping with `Bun.stringWidth`.
- terminal-column to string-index mapping.
- previous/next word boundary lookup for Option+Left/Right.

`BackendFrameRenderable` and terminal input/navigation code may consume this helper. `terminal-input.ts` must not import `BackendFrameRenderable`.

### Cursor follow remains a backend request

After successful live-mirror input, cli-shell calls `followCursor()`. This sends a backend viewport target request based on backend cursor truth. It must not directly mutate frontend viewport state.

Failed input does not follow cursor because no backend state transition is guaranteed.

## Risks / Trade-offs

- Backend capability recommendations can become stale -> keep them covered by tests and make the profile explicit.
- Option+Left/Right cannot truly move a shell cursor by setting a cursor coordinate; it must encode terminal input sequences -> test the encoded behavior and follow-cursor request, and leave native semantics to backend when enhancement is disabled.
- Home/End sequences vary across terminals -> prefer native `sequence`/`raw` when provided, and only fallback when missing.
- Some “all keys” are unknown to OpenTUI -> define and test a supported key matrix, then trace/log unsupported keys instead of pretending physical full-keyboard coverage is possible in unit tests.
